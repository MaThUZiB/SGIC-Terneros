from rest_framework import serializers
from .models import PlanConsumo, DetallePlanConsumo, AsignacionPlanLote


class DetallePlanConsumoSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.ReadOnlyField(source='producto.nombre')
    unidad_codigo = serializers.ReadOnlyField(source='unidad.codigo')

    class Meta:
        model = DetallePlanConsumo
        fields = '__all__'


class PlanConsumoSerializer(serializers.ModelSerializer):
    detalles = DetallePlanConsumoSerializer(many=True, read_only=True)

    class Meta:
        model = PlanConsumo
        fields = '__all__'


class AsignacionPlanLoteSerializer(serializers.ModelSerializer):
    plan_nombre = serializers.ReadOnlyField(source='plan.nombre')
    lote_codigo = serializers.ReadOnlyField(source='lote.codigo')

    class Meta:
        model = AsignacionPlanLote
        fields = '__all__'