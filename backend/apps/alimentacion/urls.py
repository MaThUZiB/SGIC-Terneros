from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PlanConsumoViewSet, DetallePlanConsumoViewSet, AsignacionPlanLoteViewSet

router = DefaultRouter()
router.register(r'planes-consumo', PlanConsumoViewSet, basename='plan-consumo')
router.register(r'detalles-planes-consumo', DetallePlanConsumoViewSet, basename='detalle-plan-consumo')
router.register(r'asignaciones-planes-lotes', AsignacionPlanLoteViewSet, basename='asignacion-plan-lote')

urlpatterns = [
    path('', include(router.urls)),
]