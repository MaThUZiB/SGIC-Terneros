from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    
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