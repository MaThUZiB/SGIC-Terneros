from rest_framework import serializers
from apps.ganaderia.models import Lote, Raza
from apps.ganaderia.serializers import AnimalSerializer
from .models import Proveedor, CompraAnimal, DetalleCompraAnimal


class ProveedorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Proveedor
        fields = '__all__'


class DetalleCompraAnimalSerializer(serializers.ModelSerializer):
    animal_detail = AnimalSerializer(source='animal', read_only=True)

    class Meta:
        model = DetalleCompraAnimal
        fields = '__all__'


class CompraAnimalSerializer(serializers.ModelSerializer):
    detalles = DetalleCompraAnimalSerializer(many=True, read_only=True)
    proveedor_nombre = serializers.ReadOnlyField(source='proveedor.nombre')

    class Meta:
        model = CompraAnimal
        fields = '__all__'


class AnimalCompraWriteSerializer(serializers.Serializer):
    diio = serializers.CharField()
    raza = serializers.PrimaryKeyRelatedField(queryset=Raza.objects.all())
    sexo = serializers.CharField()
    fecha_nacimiento = serializers.DateField(required=False, allow_null=True)
    edad_aproximada_dias = serializers.IntegerField(required=False, default=0)
    fecha_adquisicion = serializers.DateField(required=False)
    precio_adquisicion = serializers.DecimalField(max_digits=12, decimal_places=2)
    peso_ingreso_kg = serializers.DecimalField(max_digits=8, decimal_places=2, required=False, allow_null=True)
    observaciones = serializers.CharField(required=False, allow_blank=True)


class LoteNuevoWriteSerializer(serializers.Serializer):
    codigo = serializers.CharField()
    fecha_ingreso = serializers.DateField(required=False)
    observaciones = serializers.CharField(required=False, allow_blank=True)


class CompraAnimalCreateSerializer(serializers.Serializer):
    fecha = serializers.DateField()
    proveedor = serializers.PrimaryKeyRelatedField(queryset=Proveedor.objects.all(), required=False, allow_null=True)
    observaciones = serializers.CharField(required=False, allow_blank=True)
    lote_nuevo = LoteNuevoWriteSerializer(required=False)
    lote = serializers.PrimaryKeyRelatedField(queryset=Lote.objects.all(), required=False, allow_null=True)
    animales = AnimalCompraWriteSerializer(many=True)

    def validate(self, attrs):
        if attrs.get('lote_nuevo') and attrs.get('lote'):
            raise serializers.ValidationError('Indique solo lote_nuevo (compra normal) o solo lote (incorporación excepcional).')
        if not attrs.get('lote_nuevo') and not attrs.get('lote'):
            raise serializers.ValidationError('Debe indicar lote_nuevo o lote.')
        return attrs