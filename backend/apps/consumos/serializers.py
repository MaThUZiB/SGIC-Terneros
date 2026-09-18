from rest_framework import serializers
from apps.ganaderia.models import Lote
from apps.inventario.models import Producto, UnidadMedida
from .models import Consumo, DetalleConsumo


class DetalleConsumoSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.ReadOnlyField(source='producto.nombre')
    unidad_codigo = serializers.ReadOnlyField(source='unidad.codigo')

    class Meta:
        model = DetalleConsumo
        fields = '__all__'


class ConsumoSerializer(serializers.ModelSerializer):
    detalles = DetalleConsumoSerializer(many=True, read_only=True)
    lote_codigo = serializers.ReadOnlyField(source='lote.codigo')

    class Meta:
        model = Consumo
        fields = '__all__'


class DetalleConsumoWriteSerializer(serializers.Serializer):
    producto = serializers.PrimaryKeyRelatedField(queryset=Producto.objects.all())
    cantidad = serializers.DecimalField(max_digits=12, decimal_places=3)
    unidad = serializers.PrimaryKeyRelatedField(
        queryset=UnidadMedida.objects.all(), required=False, allow_null=True)


class ConsumoCreateSerializer(serializers.Serializer):
    fecha = serializers.DateField()
    lote = serializers.PrimaryKeyRelatedField(
        queryset=Lote.objects.all(), required=False, allow_null=True)
    origen = serializers.ChoiceField(choices=['PLAN', 'REAL', 'AJUSTE'], default='REAL')
    observaciones = serializers.CharField(required=False, allow_blank=True)
    detalles = DetalleConsumoWriteSerializer(many=True)