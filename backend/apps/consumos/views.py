from rest_framework import viewsets
from .models import Consumo, DetalleConsumo
from .serializers import ConsumoSerializer, DetalleConsumoSerializer


class ConsumoViewSet(viewsets.ModelViewSet):
    queryset = Consumo.objects.all()
    serializer_class = ConsumoSerializer


class DetalleConsumoViewSet(viewsets.ModelViewSet):
    queryset = DetalleConsumo.objects.all()
    serializer_class = DetalleConsumoSerializer