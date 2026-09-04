from rest_framework import serializers
from .models import CategoriaProducto, UnidadMedida, Producto, PresentacionProducto, ConversionProducto, MovimientoInventario


class CategoriaProductoSerializer(serializers.ModelSerializer):
    class Meta:
        model = CategoriaProducto
        fields = '__all__'


class UnidadMedidaSerializer(serializers.ModelSerializer):
    class Meta:
        model = UnidadMedida
        fields = '__all__'


class PresentacionProductoSerializer(serializers.ModelSerializer):
    class Meta:
        model = PresentacionProducto
        fields = '__all__'


class ConversionProductoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConversionProducto
        fields = '__all__'


class ProductoSerializer(serializers.ModelSerializer):
    categoria_nombre = serializers.ReadOnlyField(source='categoria.nombre')
    unidad_base_codigo = serializers.ReadOnlyField(source='unidad_base.codigo')
    presentaciones = PresentacionProductoSerializer(many=True, read_only=True)

    class Meta:
        model = Producto
        fields = '__all__'


class MovimientoInventarioSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.ReadOnlyField(source='producto.nombre')

    class Meta:
        model = MovimientoInventario
        fields = '__all__'