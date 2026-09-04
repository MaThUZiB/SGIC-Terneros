from rest_framework import serializers
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