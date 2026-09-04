from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CategoriaGastoViewSet, GastoViewSet

router = DefaultRouter()
router.register(r'categorias-gastos', CategoriaGastoViewSet, basename='categoria-gasto')
router.register(r'gastos', GastoViewSet, basename='gasto')

urlpatterns = [
    path('', include(router.urls)),
]