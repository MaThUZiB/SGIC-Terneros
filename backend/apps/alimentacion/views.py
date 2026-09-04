from rest_framework import viewsets
from .models import PlanConsumo, DetallePlanConsumo, AsignacionPlanLote
from .serializers import PlanConsumoSerializer, DetallePlanConsumoSerializer, AsignacionPlanLoteSerializer


class PlanConsumoViewSet(viewsets.ModelViewSet):
    queryset = PlanConsumo.objects.all()
    serializer_class = PlanConsumoSerializer


class DetallePlanConsumoViewSet(viewsets.ModelViewSet):
    queryset = DetallePlanConsumo.objects.all()
    serializer_class = DetallePlanConsumoSerializer


class AsignacionPlanLoteViewSet(viewsets.ModelViewSet):
    queryset = AsignacionPlanLote.objects.all()
    serializer_class = AsignacionPlanLoteSerializer