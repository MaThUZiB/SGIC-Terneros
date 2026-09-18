from rest_framework import serializers
from apps.ganaderia.models import Animal
from apps.inventario.models import Producto
from .models import Tratamiento


class TratamientoSerializer(serializers.ModelSerializer):
    animal_diio = serializers.ReadOnlyField(source='animal.diio')
    producto_nombre = serializers.ReadOnlyField(source='producto.nombre')

    class Meta:
        model = Tratamiento
        fields = '__all__'


class TratamientoCreateSerializer(serializers.Serializer):
    animal = serializers.PrimaryKeyRelatedField(queryset=Animal.objects.all())
    producto = serializers.PrimaryKeyRelatedField(queryset=Producto.objects.all())
    fecha = serializers.DateField()
    cantidad = serializers.DecimalField(max_digits=12, decimal_places=3, required=False, allow_null=True)
    motivo = serializers.CharField(max_length=200)
    observaciones = serializers.CharField(required=False, allow_blank=True)