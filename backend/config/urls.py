from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

urlpatterns = [
    #Pagina de ADMINISTRACIÓN
    path('admin/', admin.site.urls),
    #Esquema OpenAPI y Documentación
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    #Swagger UI
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    #Redoc (Documentación Alternativa)
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

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
]