from rest_framework.permissions import BasePermission, SAFE_METHODS

GRUPO_ADMIN = 'Administrador'
GRUPO_OPERADOR = 'Operador'


def es_administrador(user):
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser or user.is_staff:
        return True
    return user.groups.filter(name=GRUPO_ADMIN).exists()


class EsAdministrador(BasePermission):
    """Solo Administradores. Se usa para catálogos y configuración."""

    message = 'Requiere rol de Administrador.'

    def has_permission(self, request, view):
        return es_administrador(request.user)


class EsAdministradorOLectura(BasePermission):
    """Lectura permitida a cualquier usuario autenticado; escritura solo admin."""

    message = 'El rol Operador solo puede consultar este recurso.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return es_administrador(request.user)