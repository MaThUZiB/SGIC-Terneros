from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.exceptions import MethodNotAllowed
from .models import Tratamiento
from .serializers import TratamientoSerializer, TratamientoCreateSerializer
from .services import registrar_tratamiento


class TratamientoViewSet(viewsets.ModelViewSet):
    queryset = Tratamiento.objects.select_related('animal', 'producto').all()
    serializer_class = TratamientoSerializer

    def create(self, request, *args, **kwargs):
        serializer = TratamientoCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tratamiento = registrar_tratamiento(serializer.validated_data, request.user)
        tratamiento.refresh_from_db()
        return Response(self.get_serializer(tratamiento).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        raise MethodNotAllowed(request.method)

    def partial_update(self, request, *args, **kwargs):
        raise MethodNotAllowed(request.method)

    def destroy(self, request, *args, **kwargs):
        raise MethodNotAllowed(request.method)