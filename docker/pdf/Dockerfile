FROM alpine:3.22

RUN apk add --no-cache \
    ca-certificates \
    chromium \
    font-noto \
    fontconfig \
    freetype \
    harfbuzz \
    nginx \
    nss \
    ttf-freefont

COPY nginx.conf /etc/nginx/http.d/default.conf

EXPOSE 9222

CMD ["sh", "-lc", "chromium --headless=new --no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage --disable-gpu --disable-software-rasterizer --disable-background-networking --disable-component-update --disable-default-apps --disable-extensions --disable-sync --metrics-recording-only --mute-audio --no-first-run --remote-debugging-address=127.0.0.1 --remote-debugging-port=9223 --remote-allow-origins='*' --user-data-dir=/tmp/chromium about:blank >/dev/null 2>&1 & exec nginx -g 'daemon off;'"]
