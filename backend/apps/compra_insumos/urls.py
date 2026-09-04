from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CompraInsumoViewSet, DetalleCompraInsumoViewSet

router = DefaultRouter()
router.register(r'compras-insumos', CompraInsumoViewSet, basename='compra-insumo')
router.register(r'detalles-compras-insumos', DetalleCompraInsumoViewSet, basename='detalle-compra-insumo')

urlpatterns = [
    path('', include(router.urls)),
]