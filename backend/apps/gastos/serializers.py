from rest_framework import serializers
from .models import CategoriaGasto, Gasto


class CategoriaGastoSerializer(serializers.ModelSerializer):
    class Meta:
        model = CategoriaGasto
        fields = '__all__'


class GastoSerializer(serializers.ModelSerializer):
    categoria_nombre = serializers.ReadOnlyField(source='categoria.nombre')
    lote_codigo = serializers.ReadOnlyField(source='lote.codigo')

    class Meta:
        model = Gasto
        fields = '__all__'