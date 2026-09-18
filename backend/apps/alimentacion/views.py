from rest_framework import viewsets, status, decorators
from rest_framework.response import Response
from config.permissions import EsAdministrador
from apps.consumos.services import generar_consumo_desde_plan
from apps.consumos.serializers import ConsumoSerializer
from .models import PlanConsumo, DetallePlanConsumo, AsignacionPlanLote
from .serializers import PlanConsumoSerializer, DetallePlanConsumoSerializer, AsignacionPlanLoteSerializer


class PlanConsumoViewSet(viewsets.ModelViewSet):
    """Creación y mantención de planes (solo administradores)."""
    queryset = PlanConsumo.objects.prefetch_related('detalles__producto').all()
    serializer_class = PlanConsumoSerializer
    permission_classes = [EsAdministrador]


class DetallePlanConsumoViewSet(viewsets.ModelViewSet):
    queryset = DetallePlanConsumo.objects.select_related('producto', 'unidad').all()
    serializer_class = DetallePlanConsumoSerializer
    permission_classes = [EsAdministrador]


class AsignacionPlanLoteViewSet(viewsets.ModelViewSet):
    """Asocia planes reutilizables a lotes y permite generar el consumo habitual."""
    queryset = AsignacionPlanLote.objects.select_related('lote', 'plan').all()
    serializer_class = AsignacionPlanLoteSerializer

    @decorators.action(detail=True, methods=['post'])
    def generar_consumo(self, request, pk=None):
        asignacion = self.get_object()
        fecha = request.data.get('fecha')
        if not fecha:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'fecha': 'Campo requerido.'})
        consumo = generar_consumo_desde_plan(
            asignacion, request.user, fecha, request.data.get('observaciones', ''))
        consumo.refresh_from_db()
        return Response(ConsumoSerializer(consumo).data, status=status.HTTP_201_CREATED)

    @decorators.action(detail=True, methods=['post'])
    def finalizar(self, request, pk=None):
        from rest_framework.exceptions import ValidationError
        asignacion = self.get_object()
        asignacion.fecha_fin = request.data.get('fecha_fin')
        asignacion.activo = False
        asignacion.save(update_fields=['fecha_fin', 'activo'])
        return Response(self.get_serializer(asignacion).data)