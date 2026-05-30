import type { FastifyReply } from "fastify";

export const sendApiError = (
  reply: FastifyReply,
  statusCode: number,
  code: string,
  details?: unknown
) => {
  return reply.status(statusCode).send({
    error: code,
    ...(details === undefined ? {} : { details }),
  });
};
