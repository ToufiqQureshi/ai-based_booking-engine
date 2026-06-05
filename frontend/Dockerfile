# ── Stage 1: Build ───────────────────────────────────────────────────────────
# Uses Node only for building — NOT included in the final image
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./
RUN npm install

# Copy application code
COPY . .

# Build Arguments for Vite (must be set at build time, not runtime)
ARG VITE_API_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

# Build production bundle
RUN npm run build

# ── Stage 2: Serve ───────────────────────────────────────────────────────────
# Only nginx + built static files go into the final image (~25MB vs ~200MB)
FROM nginx:alpine

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy our custom nginx config (SPA routing + gzip + caching)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
