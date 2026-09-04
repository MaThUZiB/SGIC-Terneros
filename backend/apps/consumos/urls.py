from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ConsumoViewSet, DetalleConsumoViewSet

router = DefaultRouter()
router.register(r'consumos', ConsumoViewSet, basename='consumo')
router.register(r'detalles-consumos', DetalleConsumoViewSet, basename='detalle-consumo')

urlpatterns = [
    path('', include(router.urls)),
]