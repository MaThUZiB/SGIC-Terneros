from rest_framework import serializers
from .models import Raza, Lote, Animal, PesoAnimal


class RazaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Raza
        fields = '__all__'


class PesoAnimalSerializer(serializers.ModelSerializer):
    animal_diio = serializers.ReadOnlyField(source='animal.diio')

    class Meta:
        model = PesoAnimal
        fields = '__all__'


class AnimalSerializer(serializers.ModelSerializer):
    pesajes = PesoAnimalSerializer(many=True, read_only=True)
    raza_nombre = serializers.ReadOnlyField(source='raza.nombre')
    lote_codigo = serializers.ReadOnlyField(source='lote.codigo')

    class Meta:
        model = Animal
        fields = '__all__'


class AnimalResumenSerializer(serializers.ModelSerializer):
    raza_nombre = serializers.ReadOnlyField(source='raza.nombre')

    class Meta:
        model = Animal
        fields = ['id', 'diio', 'raza_nombre', 'sexo', 'estado', 'peso_ingreso_kg', 'precio_adquisicion']


class LoteSerializer(serializers.ModelSerializer):
    animales_count = serializers.IntegerField(source='animales.count', read_only=True)
    animales = AnimalSerializer(many=True, read_only=True)
    lote_origen_codigo = serializers.ReadOnlyField(source='lote_origen.codigo')

    class Meta:
        model = Lote
        fields = '__all__'