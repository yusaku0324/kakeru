"""Security headers middleware for FastAPI."""

from __future__ import annotations

import logging
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware to add security headers to all responses."""

    def __init__(
        self,
        app,
        enable_hsts: bool = True,
        enable_csp: bool = True,
        report_uri: str | None = None,
    ):
        """Initialize security headers middleware.

        Args:
            app: FastAPI application
            enable_hsts: Enable HTTP Strict Transport Security
            enable_csp: Enable Content Security Policy
            report_uri: URI for CSP violation reports
        """
        super().__init__(app)
        self.enable_hsts = enable_hsts
        self.enable_csp = enable_csp
        self.report_uri = report_uri

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Add security headers to the response."""
        response = await call_next(request)

        # Skip headers for health checks and internal endpoints
        if request.url.path.startswith("/health") or request.url.path.startswith(
            "/api/ops/"
        ):
            return response

        # X-Content-Type-Options
        # Prevents MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # X-Frame-Options
        # Prevents clickjacking attacks
        response.headers["X-Frame-Options"] = "DENY"

        # X-XSS-Protection
        # Enable browser's XSS protection (legacy, but still useful)
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Referrer-Policy
        # Controls referrer information sent with requests
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Permissions-Policy (replacing Feature-Policy)
        # Restrict browser features
        permissions = [
            "accelerometer=()",
            "camera=()",
            "geolocation=()",
            "gyroscope=()",
            "magnetometer=()",
            "microphone=()",
            "payment=()",
            "usb=()",
            "interest-cohort=()",  # Disable FLoC
        ]
        response.headers["Permissions-Policy"] = ", ".join(permissions)

        # HTTP Strict Transport Security (HSTS)
        # Force HTTPS for future requests
        if self.enable_hsts and request.url.scheme == "https":
            # max-age=31536000 (1 year)
            # includeSubDomains: Apply to all subdomains
            # preload: Allow browser preload lists
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains; preload"
            )

        # Content-Security-Policy
        # Prevent XSS and other injection attacks
        if self.enable_csp:
            # Build CSP directives
            csp_directives = [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com",
                "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com",
                "img-src 'self' data: https: blob:",
                "font-src 'self' data: https:",
                "connect-src 'self' https://api.osakamenesu.com wss://api.osakamenesu.com",
                "media-src 'self' https: blob:",
                "object-src 'none'",
                "child-src 'self'",
                "frame-src 'self'",
                "frame-ancestors 'none'",
                "form-action 'self'",
                "base-uri 'self'",
                "manifest-src 'self'",
                "worker-src 'self' blob:",
            ]

            # Add report-uri if configured
            if self.report_uri:
                csp_directives.append(f"report-uri {self.report_uri}")
                csp_directives.append(f"report-to csp-endpoint")

                # Add Report-To header for modern browsers
                report_to = {
                    "group": "csp-endpoint",
                    "max_age": 86400,
                    "endpoints": [{"url": self.report_uri}],
                }
                response.headers["Report-To"] = str(report_to).replace("'", '"')

            # Set CSP header
            csp_header = "; ".join(csp_directives)

            # Use Report-Only mode for initial deployment
            # Change to Content-Security-Policy when confident
            response.headers["Content-Security-Policy-Report-Only"] = csp_header

        # Additional security headers for API responses
        if request.url.path.startswith("/api/"):
            # Prevent API responses from being embedded
            response.headers["X-Permitted-Cross-Domain-Policies"] = "none"

        return response


def create_security_headers_middleware(
    enable_hsts: bool = True,
    enable_csp: bool = True,
    report_uri: str | None = None,
) -> type[SecurityHeadersMiddleware]:
    """Create a configured SecurityHeadersMiddleware class.

    Args:
        enable_hsts: Enable HTTP Strict Transport Security
        enable_csp: Enable Content Security Policy
        report_uri: URI for CSP violation reports

    Returns:
        Configured middleware class
    """

    class ConfiguredSecurityHeadersMiddleware(SecurityHeadersMiddleware):
        def __init__(self, app):
            super().__init__(
                app,
                enable_hsts=enable_hsts,
                enable_csp=enable_csp,
                report_uri=report_uri,
            )

    return ConfiguredSecurityHeadersMiddleware
