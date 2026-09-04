from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CategoriaProductoViewSet, UnidadMedidaViewSet, ProductoViewSet,
    PresentacionProductoViewSet, ConversionProductoViewSet, MovimientoInventarioViewSet
)

router = DefaultRouter()
router.register(r'categorias-productos', CategoriaProductoViewSet, basename='categoria-producto')
router.register(r'unidades-medida', UnidadMedidaViewSet, basename='unidad-medida')
router.register(r'productos', ProductoViewSet, basename='producto')
router.register(r'presentaciones-productos', PresentacionProductoViewSet, basename='presentacion-producto')
router.register(r'conversiones-productos', ConversionProductoViewSet, basename='conversion-producto')
router.register(r'movimientos-inventario', MovimientoInventarioViewSet, basename='movimiento-inventario')

urlpatterns = [
    path('', include(router.urls)),
]