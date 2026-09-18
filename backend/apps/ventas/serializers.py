from rest_framework import serializers
from apps.ganaderia.models import Lote
from .models import Venta, DetalleVenta


class DetalleVentaSerializer(serializers.ModelSerializer):
    lote_codigo = serializers.ReadOnlyField(source='lote.codigo')

    class Meta:
        model = DetalleVenta
        fields = '__all__'


class VentaSerializer(serializers.ModelSerializer):
    detalles = DetalleVentaSerializer(many=True, read_only=True)

    class Meta:
        model = Venta
        fields = '__all__'


class DetalleVentaWriteSerializer(serializers.Serializer):
    lote = serializers.PrimaryKeyRelatedField(queryset=Lote.objects.all())
    cantidad_animales = serializers.IntegerField(min_value=1)


class VentaCreateSerializer(serializers.Serializer):
    fecha = serializers.DateField()
    comprador = serializers.CharField(required=False, allow_blank=True)
    peso_total_kg = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    precio_kg = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    total_venta = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    observaciones = serializers.CharField(required=False, allow_blank=True)
    detalles = DetalleVentaWriteSerializer(many=True)

    def validate(self, attrs):
        if attrs.get('total_venta') is None and not (attrs.get('peso_total_kg') and attrs.get('precio_kg')):
            raise serializers.ValidationError(
                'Indique total_venta o bien peso_total_kg y precio_kg.')
        return attrs