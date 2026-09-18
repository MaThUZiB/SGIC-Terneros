from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)
from config.auth_views import MeView

urlpatterns = [
    # Administración
    path('admin/', admin.site.urls),
    # Esquema OpenAPI y documentación
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # Autenticación (JWT)
    path('api/auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/me/', MeView.as_view(), name='auth-me'),

    # API endpoints
    path('api/ganaderia/', include('apps.ganaderia.urls')),
    path('api/compra-animales/', include('apps.compra_animales.urls')),
    path('api/inventario/', include('apps.inventario.urls')),
    path('api/compra-insumos/', include('apps.compra_insumos.urls')),
    path('api/alimentacion/', include('apps.alimentacion.urls')),
    path('api/consumos/', include('apps.consumos.urls')),
    path('api/sanidad/', include('apps.sanidad.urls')),
    path('api/gastos/', include('apps.gastos.urls')),
    path('api/ventas/', include('apps.ventas.urls')),
    path('api/auditoria/', include('apps.auditoria.urls')),
    path('api/dashboard/', include('apps.dashboard.urls')),
]