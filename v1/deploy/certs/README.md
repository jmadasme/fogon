# Certificado de origen

Cloudflare debe hablar con este origen en **Full (strict)**. Descarga el
certificado desde el panel de Cloudflare:

1. SSL/TLS → Origin Server → Create Certificate.
2. Hostnames: `fogon.cl` y `*.fogon.cl` (o los que uses).
3. Guarda el certificado como `origin.pem` y la clave como `origin.key` en
   este directorio.
4. Permisos:

```bash
chmod 600 deploy/certs/origin.key
chmod 644 deploy/certs/origin.pem
```

No uses certificados autofirmados con Full (strict): Cloudflare los rechaza.
