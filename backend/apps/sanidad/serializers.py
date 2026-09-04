from rest_framework import serializers
from .models import Tratamiento


class TratamientoSerializer(serializers.ModelSerializer):
    animal_diio = serializers.ReadOnlyField(source='animal.diio')
    producto_nombre = serializers.ReadOnlyField(source='producto.nombre')

    class Meta:
        model = Tratamiento
        fields = '__all__'