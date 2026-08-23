FROM nginx:1.27-alpine

# Brotli dynamic modules ship in the Alpine nginx package set.
RUN apk add --no-cache nginx-mod-http-brotli

COPY nginx.conf /etc/nginx/nginx.conf
COPY conf.d/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80 443

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
  CMD wget -q --spider http://127.0.0.1:80/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
