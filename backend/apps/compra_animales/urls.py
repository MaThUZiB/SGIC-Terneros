from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProveedorViewSet, CompraAnimalViewSet, DetalleCompraAnimalViewSet

router = DefaultRouter()
router.register(r'proveedores', ProveedorViewSet, basename='proveedor')
router.register(r'compras-animales', CompraAnimalViewSet, basename='compra-animal')
router.register(r'detalles-compras-animales', DetalleCompraAnimalViewSet, basename='detalle-compra-animal')

urlpatterns = [
    path('', include(router.urls)),
]