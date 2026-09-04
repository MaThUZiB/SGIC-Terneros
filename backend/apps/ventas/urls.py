from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import VentaViewSet, DetalleVentaViewSet

router = DefaultRouter()
router.register(r'ventas', VentaViewSet, basename='venta')
router.register(r'detalles-ventas', DetalleVentaViewSet, basename='detalle-venta')

urlpatterns = [
    path('', include(router.urls)),
]