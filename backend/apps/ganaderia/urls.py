from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RazaViewSet, LoteViewSet, AnimalViewSet, PesoAnimalViewSet

router = DefaultRouter()
router.register(r'razas', RazaViewSet, basename='raza')
router.register(r'lotes', LoteViewSet, basename='lote')
router.register(r'animales', AnimalViewSet, basename='animal')
router.register(r'pesos-animales', PesoAnimalViewSet, basename='peso-animal')

urlpatterns = [
    path('', include(router.urls)),
]