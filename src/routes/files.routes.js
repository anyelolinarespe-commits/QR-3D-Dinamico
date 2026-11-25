import { requireAuth } from '../middleware/auth.js';
import {
  saveUploadedFile,
  listSavedFiles,
  getSavedFileById,
  deleteSavedFile
} from '../services/fileStorage.service.js';
import { db } from '../db/pool.js';

function getFileScope(request) {
  const role = request.authUser?.role || (request.tenant?.is_master ? 'superadmin' : 'admin');
  return {
    role,
    tenantId: request.tenant?.is_master ? null : request.tenant?.id,
    userId: request.authUser?.id || null,
    filterTenantId: request.query?.tenant_id ? String(request.query.tenant_id) : null
  };
}

export async function filesRoutes(fastify) {
  // Listar archivos persistidos según rol (superadmin: todos; admin: sitio; user: propios)
  fastify.get('/api/files', { preHandler: [requireAuth] }, async (request, reply) => {
    const kind = request.query?.kind || null;
    const scope = getFileScope(request);
    const files = await listSavedFiles(scope, kind);
    const status = db.getStatus();
    return reply.send({
      files,
      totalCount: files.length,
      databaseEngine: status.engine
    });
  });

  // Subir y persistir directamente un archivo (modelo 3D o imagen) en la base de datos
  fastify.post('/api/files', { preHandler: [requireAuth] }, async (request, reply) => {
    if (!request.isMultipart || !request.isMultipart()) {
      return reply.status(400).send({
        error: 'Se requiere petición multipart/form-data con el archivo'
      });
    }

    let fileBuffer = null;
    let filename = null;
    let mimeType = 'application/octet-stream';
    let explicitKind = '';
    let explicitTenantId = '';

    const parts = request.parts();
    for await (const part of parts) {
      if (part.type === 'file') {
        const buf = await part.toBuffer();
        if (buf.length > 0 && !fileBuffer) {
          fileBuffer = buf;
          filename = part.filename || part.fieldname;
          mimeType = part.mimetype || 'application/octet-stream';
          if (part.fieldname === 'model' || part.fieldname === 'image') {
            explicitKind = explicitKind || part.fieldname;
          }
        }
      } else if (part.fieldname === 'file_kind') {
        explicitKind = String(part.value || '');
      } else if (part.fieldname === 'tenant_id') {
        explicitTenantId = String(part.value || '').trim();
      }
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return reply.status(400).send({ error: 'No se recibió ningún archivo válido' });
    }

    const isSuper = request.authUser?.role === 'superadmin' || request.tenant?.is_master;
    let targetTenantId = request.tenant.id;
    if (isSuper) {
      targetTenantId = explicitTenantId || 'tenant_default';
      const tRes = await db.query('SELECT id FROM tenants WHERE id = $1', [targetTenantId]);
      if (tRes.rows.length === 0) {
        return reply.status(404).send({ error: 'El sitio web (tenant_id) especificado no existe' });
      }
    }

    const saved = await saveUploadedFile({
      tenantId: targetTenantId,
      ownerUserId: request.authUser?.id || null,
      fileKind: explicitKind,
      filename,
      mimeType,
      buffer: fileBuffer
    });

    return reply.status(saved.deduplicated ? 200 : 201).send({
      success: true,
      file: saved
    });
  });

  // Descargar binario guardado desde la base de datos
  fastify.get('/api/files/:fileId/download', { preHandler: [requireAuth] }, async (request, reply) => {
    const { fileId } = request.params;
    const file = await getSavedFileById(fileId, getFileScope(request));
    if (!file) {
      return reply.status(404).send({ error: 'Archivo no encontrado en la base de datos' });
    }

    const safeDownloadName = (file.filename || 'archivo.bin').replace(/"/g, '');
    return reply
      .header('Content-Type', file.mime_type || 'application/octet-stream')
      .header('Content-Disposition', `attachment; filename="${safeDownloadName}"`)
      .send(file.file_blob);
  });

  // Eliminar archivo guardado de la base de datos
  fastify.delete('/api/files/:fileId', { preHandler: [requireAuth] }, async (request, reply) => {
    const { fileId } = request.params;
    const deleted = await deleteSavedFile(fileId, getFileScope(request));
    if (!deleted) {
      return reply.status(404).send({ error: 'Archivo no encontrado' });
    }
    return reply.send({ success: true, message: 'Archivo eliminado de la base de datos' });
  });
}
