from rest_framework import serializers
from .models import Raza, Lote, Animal, PesoAnimal


class RazaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Raza
        fields = '__all__'


class PesoAnimalSerializer(serializers.ModelSerializer):
    class Meta:
        model = PesoAnimal
        fields = '__all__'


class AnimalSerializer(serializers.ModelSerializer):
    pesajes = PesoAnimalSerializer(many=True, read_only=True)
    raza_nombre = serializers.ReadOnlyField(source='raza.nombre')

    class Meta:
        model = Animal
        fields = '__all__'


class LoteSerializer(serializers.ModelSerializer):
    animales_count = serializers.IntegerField(source='animales.count', read_only=True)

    class Meta:
        model = Lote
        fields = '__all__'