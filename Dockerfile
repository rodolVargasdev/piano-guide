# Stage 1: run the test suite. The runtime stage copies a marker from here,
# so the image cannot be built unless `node --test` passes.
FROM node:24.21.0-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS test
# Pick up Alpine security fixes released after the pinned digest, and drop npm:
# it is never used here and its bundled packages carry open advisories.
RUN apk upgrade --no-cache \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
WORKDIR /app
COPY package.json ./
COPY src/ ./src/
COPY tests/ ./tests/
# Guards that read these files (CSP hash against the import map).
COPY index.html nginx.conf ./
COPY songs/ ./songs/
# Guard that pins the vendored three.js bytes and the hashes in the stack document.
COPY assets/vendor/ ./assets/vendor/
COPY docs/STACK_TECNOLOGICO.md ./docs/STACK_TECNOLOGICO.md
RUN node --test && touch /app/.tests-passed

# Stage 2: static runtime on nginx, non-root, port 8080.
FROM nginx:1.30.5-alpine-slim@sha256:32463212baf0e7d91aded2e9b843a4f2b9e017804b8c9d5bae7b51dcef64389c
# Pick up Alpine security fixes released after the pinned digest.
RUN apk upgrade --no-cache
COPY --from=test /app/.tests-passed /tmp/.tests-passed
COPY nginx.conf /etc/nginx/nginx.conf
COPY index.html /usr/share/nginx/html/index.html
COPY styles/ /usr/share/nginx/html/styles/
COPY src/ /usr/share/nginx/html/src/
COPY songs/ /usr/share/nginx/html/songs/
COPY assets/ /usr/share/nginx/html/assets/
USER nginx
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
