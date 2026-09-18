from rest_framework import serializers
from apps.compra_animales.models import Proveedor
from apps.inventario.models import Producto, PresentacionProducto
from .models import CompraInsumo, DetalleCompraInsumo


class DetalleCompraInsumoSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.ReadOnlyField(source='producto.nombre')
    presentacion_nombre = serializers.ReadOnlyField(source='presentacion.nombre')

    class Meta:
        model = DetalleCompraInsumo
        fields = '__all__'


class CompraInsumoSerializer(serializers.ModelSerializer):
    detalles = DetalleCompraInsumoSerializer(many=True, read_only=True)
    proveedor_nombre = serializers.ReadOnlyField(source='proveedor.nombre')

    class Meta:
        model = CompraInsumo
        fields = '__all__'


class DetalleCompraInsumoWriteSerializer(serializers.Serializer):
    producto = serializers.PrimaryKeyRelatedField(queryset=Producto.objects.all())
    presentacion = serializers.PrimaryKeyRelatedField(
        queryset=PresentacionProducto.objects.all(), required=False, allow_null=True)
    cantidad = serializers.DecimalField(max_digits=12, decimal_places=3)
    cantidad_base = serializers.DecimalField(max_digits=12, decimal_places=3, required=False)
    precio_unitario = serializers.DecimalField(max_digits=12, decimal_places=2)
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)


class CompraInsumoCreateSerializer(serializers.Serializer):
    proveedor = serializers.PrimaryKeyRelatedField(queryset=Proveedor.objects.all())
    fecha = serializers.DateField()
    numero_documento = serializers.CharField(required=False, allow_blank=True)
    observaciones = serializers.CharField(required=False, allow_blank=True)
    detalles = DetalleCompraInsumoWriteSerializer(many=True)