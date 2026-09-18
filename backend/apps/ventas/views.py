from rest_framework import viewsets, status, decorators
from rest_framework.response import Response
from rest_framework.exceptions import MethodNotAllowed
from .models import Venta, DetalleVenta
from .serializers import VentaSerializer, DetalleVentaSerializer, VentaCreateSerializer
from .services import crear_venta, confirmar_venta, anular_venta


class VentaViewSet(viewsets.ModelViewSet):
    queryset = Venta.objects.prefetch_related('detalles__lote').all()
    serializer_class = VentaSerializer

    def create(self, request, *args, **kwargs):
        serializer = VentaCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        venta = crear_venta(serializer.validated_data, request.user)
        venta.refresh_from_db()
        return Response(self.get_serializer(venta).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        raise MethodNotAllowed(request.method)

    def partial_update(self, request, *args, **kwargs):
        raise MethodNotAllowed(request.method)

    def destroy(self, request, *args, **kwargs):
        raise MethodNotAllowed(request.method)

    @decorators.action(detail=True, methods=['post'])
    def confirmar(self, request, pk=None):
        venta = self.get_object()
        confirmar_venta(venta, request.user)
        venta.refresh_from_db()
        return Response(self.get_serializer(venta).data)

    @decorators.action(detail=True, methods=['post'])
    def anular(self, request, pk=None):
        venta = self.get_object()
        anular_venta(venta, request.user)
        venta.refresh_from_db()
        return Response(self.get_serializer(venta).data)


class DetalleVentaViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = DetalleVenta.objects.select_related('lote', 'venta').all()
    serializer_class = DetalleVentaSerializer