from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from config.permissions import es_administrador


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response({
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'es_administrador': es_administrador(user),
            'es_superuser': user.is_superuser,
            'grupos': list(user.groups.values_list('name', flat=True)),
        })