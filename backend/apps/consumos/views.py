from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.exceptions import MethodNotAllowed
from .models import Consumo, DetalleConsumo
from .serializers import (
    ConsumoSerializer,
    DetalleConsumoSerializer,
    ConsumoCreateSerializer,
)
from .services import registrar_consumo


class ConsumoViewSet(viewsets.ModelViewSet):
    queryset = Consumo.objects.select_related('lote', 'usuario').prefetch_related('detalles__producto').all()
    serializer_class = ConsumoSerializer

    def create(self, request, *args, **kwargs):
        serializer = ConsumoCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        consumo = registrar_consumo(serializer.validated_data, request.user)
        consumo.refresh_from_db()
        return Response(self.get_serializer(consumo).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        raise MethodNotAllowed(request.method)

    def partial_update(self, request, *args, **kwargs):
        raise MethodNotAllowed(request.method)

    def destroy(self, request, *args, **kwargs):
        raise MethodNotAllowed(request.method)


class DetalleConsumoViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = DetalleConsumo.objects.select_related('producto', 'unidad', 'consumo').all()
    serializer_class = DetalleConsumoSerializer