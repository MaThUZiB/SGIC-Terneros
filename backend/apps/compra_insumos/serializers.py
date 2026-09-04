from rest_framework import serializers
from .models import CompraInsumo, DetalleCompraInsumo


class DetalleCompraInsumoSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.ReadOnlyField(source='producto.nombre')

    class Meta:
        model = DetalleCompraInsumo
        fields = '__all__'


class CompraInsumoSerializer(serializers.ModelSerializer):
    detalles = DetalleCompraInsumoSerializer(many=True, read_only=True)
    proveedor_nombre = serializers.ReadOnlyField(source='proveedor.nombre')

    class Meta:
        model = CompraInsumo
        fields = '__all__'