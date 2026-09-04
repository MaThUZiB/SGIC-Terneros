from rest_framework import serializers
from .models import Proveedor, CompraAnimal, DetalleCompraAnimal
from apps.ganaderia.serializers import AnimalSerializer


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