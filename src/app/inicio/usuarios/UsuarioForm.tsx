"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Box,
  TextField,
  Typography,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  CircularProgress,
  Checkbox,
  FormControlLabel,
  Alert,
} from "@mui/material";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/material.css";
import RolesInterface from "./interfaces/RolesInterface";
import { useAuth } from '@/data/AuthContext';
import styles from "./Usuario.module.css";
import { SelectChangeEvent } from "@mui/material/Select";
import RefEmpleador from "./interfaces/RefEmpleador";
import UsuarioRow from "./interfaces/UsuarioRow";
import CustomModal from "@/utils/ui/form/CustomModal";
import CustomButton from "@/utils/ui/button/CustomButton";
import CustomModalMessage, { MessageType } from '@/utils/ui/message/CustomModalMessage';
import CargoInterface from "./interfaces/CargoInterface";
import Formato from "@/utils/Formato";
import ArtAPI from '@/data/artAPI';
import UsuarioAPI from '@/data/usuarioAPI';
import useSWR from 'swr';
import AuthAPI from '@/data/authAPI';
import dayjs from 'dayjs';
import CustomTabs from "@/utils/ui/tab/CustomTab";
import {
  UsuarioEmpresasUsuarioTab,
  type EmpresasRelacionadasMeta,
} from "./UsuarioEmpresasUsuarioTab";

// Definición del modo de operación (replicada desde UsuariosPage)
export type RequestMethod = "create" | "edit" | "view" | "delete" | "activate" | "remove";

export interface UsuarioFormFields {
  nombre: string;
  apellido?: string;
  titulo?: string;
  email: string;
  cuit: string; // Keep as string for form input, will convert to number on submit
  phoneNumber: string;
  matricula?: string;
  fechaNacimiento?: string;
  canalInterviniente?: string;
  inicioFecha?: string;
  bajaFecha?: string | null;
  domicilioCalle?: string;
  domicilioNro?: string;
  domicilioPiso?: string;
  domicilioEntreCalle1?: string;
  domicilioEntreCalle2?: string;
  domicilioCodPostal?: string;
  domicilioCodLocalidad?: string;
  domicilioLocalidad?: string;
  domicilioProvincia?: string;
  cargoId?: number;
  password?: string;
  confirmPassword?: string;
  rol: string;
  maxUsuarios?: number;
  cantidadUsuarios?: number;
  // tipo: string;
  userName: string;
  empresaId: number;
  id?: string;
  comision?: number;
  serviciosAdicionales?: number;
  aplicaIva?: number;
  srtComercializadorOrganizadorInterno?: number;
  sectorId?: number;
}

const ROLES_EXCLUIDOS_USUARIOS = ["comercializador", "grupoorganizador", "organizadorcomercializador", "administrador"];

export interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (formData: UsuarioFormFields) => void;
  roles: RolesInterface[];
  cargos: CargoInterface[];
  refEmpleadores: RefEmpleador[];
  usuarios?: UsuarioRow[];
  initialData?: UsuarioFormFields;
  errorMsg?: string | null;
  method: RequestMethod; // MODO DE OPERACIÓN
  isSubmitting?: boolean;
  isAdmin?: boolean; // Nuevo parámetro para determinar si el usuario es admin
  /** Tras registrar usuario: forzar pestaña Empresas y al menos una relación antes de cerrar el modal. */
  awaitingEmpresaRelation?: boolean;
  onEmpresaRelationSatisfied?: () => void;
  onEmpresaMutate?: () => Promise<void>;
}

const initialFormState: UsuarioFormFields = {
  nombre: "",
  apellido: "",
  titulo: "",
  email: "",
  cuit: "",
  phoneNumber: "",
  cargoId: undefined,
  password: "",
  confirmPassword: "",
  rol: "",
  maxUsuarios: 0,
  cantidadUsuarios: 0,
  // tipo: "",
  userName: "",
  empresaId: 0,
  sectorId: undefined,
};

// Interfaces completas para errores y campos tocados
export interface ValidationErrors {
  nombre?: string;
  apellido?: string;
  titulo?: string;
  email?: string;
  cuit?: string;
  phoneNumber?: string;
  matricula?: string;
  fechaNacimiento?: string;
  domicilioCalle?: string;
  domicilioNro?: string;
  domicilioPiso?: string;
  domicilioEntreCalle1?: string;
  domicilioEntreCalle2?: string;
  domicilioCodPostal?: string;
  domicilioCodLocalidad?: string;
  domicilioLocalidad?: string;
  domicilioProvincia?: string;
  cargoId?: string;
  password?: string;
  confirmPassword?: string;
  rol?: string;
  // tipo?: string;
  // userName?: string;
  empresaId?: string;
  id?: string;
  maxUsuarios?: string;
  cantidadUsuarios?: string;
  sectorId?: string;
}

export interface TouchedFields {
  nombre?: boolean;
  apellido?: boolean;
  titulo?: boolean;
  email?: boolean;
  cuit?: boolean;
  phoneNumber?: boolean;
  matricula?: boolean;
  fechaNacimiento?: boolean;
  canalInterviniente?: boolean;
  inicioFecha?: boolean;
  bajaFecha?: boolean;
  domicilioCalle?: boolean;
  domicilioNro?: boolean;
  domicilioPiso?: boolean;
  domicilioEntreCalle1?: boolean;
  domicilioEntreCalle2?: boolean;
  domicilioCodPostal?: boolean;
  domicilioCodLocalidad?: boolean;
  domicilioLocalidad?: boolean;
  domicilioProvincia?: boolean;
  cargoId?: boolean;
  password?: boolean;
  confirmPassword?: boolean;
  rol?: boolean;
  // tipo?: boolean;
  // userName?: boolean;
  empresaId?: boolean;
  id?: boolean;
  comision?: boolean;
  serviciosAdicionales?: boolean;
  aplicaIva?: boolean;
  maxUsuarios?: boolean;
  cantidadUsuarios?: boolean;
  sectorId?: boolean;
}

export const LEYENDA_ASOCIAR_EMPRESA_ANTES_DE_GUARDAR =
  "Debe asociar al menos una empresa desde la solapa 'Empresas del usuario' antes de guardar los cambios.";

// Título a mostrar cuando el usuario ya fue registrado pero necesita relacionar empresas
export const TITULO_USUARIO_REGISTRADO = "Usuario Registrado";

export default function UsuarioForm({
  open,
  onClose,
  onSubmit,
  roles,
  cargos,
  refEmpleadores,
  usuarios = [],
  initialData,
  errorMsg,
  method,
  isSubmitting = false,
  isAdmin = false,
  awaitingEmpresaRelation = false,
  onEmpresaRelationSatisfied,
  onEmpresaMutate,
}: Props) {
  const [form, setForm] = useState<UsuarioFormFields>(initialFormState);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<TouchedFields>({});
  const [isAdminUser, setIsAdminUser] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [modalMsgOpen, setModalMsgOpen] = useState<boolean>(false);
  const [modalMsgText, setModalMsgText] = useState<string>("");
  const [modalMsgType, setModalMsgType] = useState<MessageType>('error');
  const [arcaCUIL, setArcaCUIL] = useState<number | undefined>(undefined);
  const [fichaTab, setFichaTab] = useState(0);
  const [empresasRelMeta, setEmpresasRelMeta] = useState<EmpresasRelacionadasMeta | null>(null);

  const { user } = useAuth();
  const isAdminEmpleador = user?.rol?.toLowerCase() === "administradorempleador";
  // --- Lógica de Modos y Estado ---
  const isViewing = method === "view";
  const isEditing = method === "edit";
  const isCreating = method === "create";
  const isDeleting = method === "delete";
  const isActivating = method === "activate";
  const isDisabled = isViewing || isDeleting || isActivating;
  const hasEmpresasTab = true;
  const empresasTabDisabled = isCreating && !Boolean(form.id);
  const requiresTituloMatricula = form.rol === "MedicinaLaboral" || form.rol === "SeguridadEHigiene";

  const rolRequiereEmpresa = useMemo(() => {
    const rolObj = roles.find(r => r.nombre === form.rol || r.nombreNormalizado === form.rol);
    const adminEmpleador = roles.find(r => r.nombreNormalizado?.toLowerCase() === "administradorempleador");
    return rolObj?.nombreNormalizado?.toLowerCase() === "administradorempleador" ||
      adminEmpleador?.rolesHijos.some(h => h.id === rolObj?.id) === true;
  }, [roles, form.rol]);

  const roleOptions = useMemo(() => {
    const userRole = roles.find(r => r.nombreNormalizado.toLowerCase() === user?.rol?.toLowerCase());
    const baseRoles = (!userRole || userRole.rolesHijos.length === 0)
      ? roles
      : (() => { const hijoIds = new Set(userRole.rolesHijos.map(h => h.id)); return roles.filter(r => hijoIds.has(r.id)); })();
    const isExcludedRole = (rol: RolesInterface) =>
      ROLES_EXCLUIDOS_USUARIOS.includes(rol.nombreNormalizado.toLowerCase());
    const currentRole = roles.find(r => r.nombre === form.rol);
    const currentExcluded = currentRole ? isExcludedRole(currentRole) : false;

    const allowed = baseRoles
      .filter(r => !isExcludedRole(r))
      .map((rol) => ({ rol, disabled: false }));

    if (currentExcluded && currentRole) {
      return [{ rol: currentRole, disabled: true }];
    }

    return allowed;
  }, [roles, user?.rol, isEditing, isViewing, form.rol]);

  const isRolSelectDisabled = isDisabled || isAdminUser || (isEditing && roleOptions.length === 1 && roleOptions[0].disabled);

  // Función helper para formatear CUIT
  const formatCuit = (cuit: string): string => {
    if (!cuit) return "";
    const cleanCuit = cuit.replace(/[^0-9]/g, '');
    if (cleanCuit.length <= 2) return cleanCuit;
    if (cleanCuit.length <= 10) {
      return cleanCuit.substring(0, 2) + '-' + cleanCuit.substring(2);
    }
    return cleanCuit.substring(0, 2) + '-' + cleanCuit.substring(2, 10) + '-' + cleanCuit.substring(10);
  };

  useEffect(() => {
    if (!open) return;

    // Restablecer el formulario y los estados de error/tocado al abrir o cambiar los datos
    if (initialData) {
      const processedData = { ...initialData };

      // Aplicar formato al CUIT
      console.log("Initial:", processedData);
      if (processedData.userName) {
        processedData.cuit = formatCuit(processedData.userName);
      }

      // Asegurar que cargoId tenga un valor válido - solo para edición/vista
      if ((!processedData.cargoId || processedData.cargoId === 0) && !isCreating) {
        processedData.cargoId = cargos.length > 0 ? cargos[0].id : undefined;
      }
      
      // En modo edición, limpiar campos que deben aparecer vacíos
      if (isEditing) {
        // Siempre limpiar contraseñas en modo edición
        processedData.password = "";
        processedData.confirmPassword = "";
      }

      if (processedData.empresaId) {
        const empresa = refEmpleadores.find(
          (item) => item.interno === processedData.empresaId
        );
        if (empresa?.cantidadUsuariosMaxima !== undefined) {
          processedData.maxUsuarios = empresa.cantidadUsuariosMaxima;
        }
        const currentCountFromList = usuarios.filter((u) => u.empresaId === processedData.empresaId).length;
        processedData.cantidadUsuarios = empresa?.cantidadUsuarios ?? currentCountFromList;
      }

      setForm(processedData);
    } else {
      setForm(initialFormState);
    }

    setErrors({});
    setTouched({});
    setIsAdminUser(false); // Resetear el checkbox cuando se abre el modal
    setShowPassword(false); // Resetear la visibilidad de contraseña
    setArcaCUIL(undefined); // Limpiar cualquier consulta ARCA previa al abrir el modal
    setEmpresasRelMeta(null);
    setFichaTab(awaitingEmpresaRelation ? 1 : 0);
  }, [initialData, open, isEditing, isCreating]);

  useEffect(() => {
    if (!awaitingEmpresaRelation) return;
    if (!empresasRelMeta || empresasRelMeta.isLoading) return;
    if (empresasRelMeta.count >= 1) {
      onEmpresaRelationSatisfied?.();
    }
  }, [awaitingEmpresaRelation, empresasRelMeta, onEmpresaRelationSatisfied]);

  const handleEmpresasRelacionadasMetaChange = useCallback((meta: EmpresasRelacionadasMeta) => {
    setEmpresasRelMeta(meta);
  }, []);

  const mustBlockModalClose =
    awaitingEmpresaRelation &&
    (empresasRelMeta === null || empresasRelMeta.isLoading || empresasRelMeta.count < 1);

  const handleModalCloseAttempt = useCallback(() => {
    if (isSubmitting) return;
    if (mustBlockModalClose) {
      setModalMsgText(
        'Debe vincular al menos una empresa al usuario en la pestaña "Empresas del Usuario" antes de cerrar el asistente.'
      );
      setModalMsgType("warning");
      setModalMsgOpen(true);
      return;
    }
    onClose();
  }, [isSubmitting, mustBlockModalClose, onClose]);

  const modalTitle = useMemo(() => {
    switch (method) {
      case "create":
        return "Crear Nuevo Usuario";
      case "edit":
        return `Editar Usuario: ${form.nombre || ""}`;
      case "view":
        return `Detalles Usuario: ${form.nombre || ""}`;
      case "delete":
        return `Dar de baja Usuario: ${form.nombre || ""}`;
      case "activate":
        return `Activar Usuario: ${form.nombre || ""}`;
      default:
        return "Formulario de Usuario";
    }
  }, [method, form.nombre]);

  // --- Funciones de Validación --- 

  const validateCuit = (cuit: string): string | undefined => {
    if (!cuit.trim()) return "CUIT es requerido";
    const cleanCuit = cuit.replace(/[^\d]/g, "");
    if (cleanCuit.length !== 11) return "CUIT debe tener 11 dígitos";
    // Basic CUIT validation algorithm
    const factors = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    const digits = cleanCuit.split("").map(Number);
    const sum = digits
      .slice(0, 10)
      .reduce((acc, digit, index) => acc + digit * factors[index], 0);
    const verifierDigit = 11 - (sum % 11);
    const expectedDigit =
      verifierDigit >= 10 ? verifierDigit - 11 : verifierDigit;
    if (digits[10] !== expectedDigit) return "CUIT inválido";
    return undefined;
  };

  const validateEmail = (email: string): string | undefined => {
    if (!email.trim()) return "Email es requerido";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return "Formato de email inválido";
    return undefined;
  };

  const validatePassword = (password: string): string | undefined => {
    if (!password) return "Contraseña es requerida";
    if (password.length < 8)
      return "La contraseña debe tener al menos 8 caracteres";
    if (!/(?=.*[a-z])/.test(password))
      return "La contraseña debe contener al menos una letra minúscula";
    if (!/(?=.*[A-Z])/.test(password))
      return "La contraseña debe contener al menos una letra mayúscula";
    if (!/(?=.*\d)/.test(password))
      return "La contraseña debe contener al menos un número";
    if (!/(?=.*[@$!%*?&])/.test(password))
      return "La contraseña debe contener al menos un carácter especial (@$!%*?&)";
    return undefined;
  };

  const validateConfirmPassword = (
    confirmPassword: string,
    password: string
  ): string | undefined => {
    if (!confirmPassword) return "Confirmación de contraseña es requerida";
    if (confirmPassword !== password) return "Las contraseñas no coinciden";
    return undefined;
  };

  // const validatePhoneNumber = (phoneNumber: string): string | undefined => {
  //   if (!phoneNumber.trim()) return "Número de teléfono es requerido";
  //   const cleanPhone = phoneNumber.replace(/[^\d]/g, "");
  //   if (cleanPhone.length < 10)
  //     return "El teléfono debe tener al menos 10 dígitos";
  //   return undefined;
  // };

  const validateRequired = (
    value: string,
    fieldName: string
  ): string | undefined => {
    if (!value.trim()) return `${fieldName} es requerido`;
    return undefined;
  };

  const validateField = (
    name: keyof UsuarioFormFields,
    value: string
  ): string | undefined => {
    switch (name) {
      case "cuit":
        return validateCuit(value);
      case "email":
        return validateEmail(value);
      case "password":
        // Solo validar password si estamos creando, o si estamos editando y el usuario ingresó algo
        if (isCreating) {
          return validatePassword(value);
        } else if (isEditing) {
          // En edición, solo validar si hay algo escrito
          if (value.trim() !== "") {
            return validatePassword(value);
          }
          // Si está vacío en edición, no hay error (significa que no quiere cambiar la contraseña)
          return undefined;
        }
        return undefined;
      case "confirmPassword":
        // Solo validar confirmPassword si estamos creando, o si estamos editando y hay password
        if (isCreating) {
          return validateConfirmPassword(value, form.password || "");
        } else if (isEditing) {
          // En edición, solo validar si alguno de los campos de password tiene contenido
          const hasPassword = form.password && form.password.trim() !== "";
          const hasConfirmPassword = value.trim() !== "";

          if (hasPassword || hasConfirmPassword) {
            // Si cualquiera tiene contenido, validar ambos
            return validateConfirmPassword(value, form.password || "");
          }
          // Si ambos están vacíos, no hay error (no quiere cambiar contraseña)
          return undefined;
        }
        return undefined;
      // case "phoneNumber":
      //   return validatePhoneNumber(value);
      case "nombre":
        return validateRequired(value, "Nombre");
      case "titulo":
        if (!requiresTituloMatricula) {
          return undefined;
        }
        return validateRequired(value, "Título Habilitante");
      case "matricula":
        if (!requiresTituloMatricula) {
          return undefined;
        }
        return validateRequired(value, "Matrícula");
      // case "userName":
      //   return validateRequired(value, "Usuario");
      // case "tipo":
      //   return validateRequired(value, "Tipo");
      case "rol":
        // No validar rol si está marcado como administrador en modo creación
        if (isCreating && isAdminUser) {
          return undefined;
        }
        return validateRequired(value, "Rol");
      case "cargoId":
        if (isAdminEmpleador) return undefined;
        return validateRequired(String(value), "Cargo");
      case "empresaId":
        // El campo "Empresa" no se gestiona en esta ficha.
        return undefined;
      case "sectorId":
        if (isAdminEmpleador) return undefined;
        return validateRequired(String(value), "Sector");
      default:
        return undefined;
    }
  };

  const validateAllFields = (): boolean => {
    const newErrors: ValidationErrors = {};
    let hasErrors = false;

    // No validar en modos 'view' o 'delete'
    if (isDisabled) return true;

    // Validar todos los campos
    (Object.keys(form) as (keyof UsuarioFormFields)[]).forEach((fieldName) => {
      const value = String(form[fieldName] ?? "");
      const error = validateField(fieldName, value);
      if (error) {
        newErrors[fieldName] = error;
        hasErrors = true;
      }
    });

    // Si estamos creando un usuario para una empresa, validar el límite de usuarios
    const max = Number(form.maxUsuarios ?? 0);
    const current = Number(form.cantidadUsuarios ?? 0);
    if (max > 0 && current >= max) {
      const msg = "Se alcanzó el límite de usuarios para esta empresa. Por favor comunicarse con un operador de la ART";
      newErrors.maxUsuarios = msg;
      // mostrar modal de error
      setModalMsgText(msg);
      setModalMsgType('error');
      setModalMsgOpen(true);
      hasErrors = true;
    }

    setErrors(newErrors);
    return !hasErrors;
  };

  // --- Handlers ---

  const handleTextFieldChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const fieldName = name as keyof UsuarioFormFields;

    if (name === "cuit") {
      const cleanValue = (value || '').replace(/[^0-9]/g, '');
      if (cleanValue.length <= 11) {
        const formattedCuit = formatCuit(cleanValue);
        setForm((prev: UsuarioFormFields) => ({
          ...prev,
          [name]: formattedCuit,
        }));
        // Si completó 11 dígitos, disparar consulta ARCA
        if (cleanValue.length === 11) {
          setArcaCUIL(Number(cleanValue));
        } else {
          setArcaCUIL(undefined);
        }
      }
    } else if (name === "matricula") {
      const matriculaValue = form.rol === "SeguridadEHigiene" ? value : value.replace(/\D/g, '');
      setForm((prev: UsuarioFormFields) => ({
        ...prev,
        [name]: matriculaValue,
      }));
    } else {
      setForm((prev: UsuarioFormFields) => ({
        ...prev,
        [name]: value,
      }));
    }

    if (touched[fieldName]) {
      const error = validateField(fieldName, name === "cuit" ? formatCuit(value.replace(/[^0-9]/g, '')) : value);
      setErrors((prev) => ({
        ...prev,
        [fieldName]: error,
      }));
    }
  };

  const handleSelectChange = (e: SelectChangeEvent<string>) => {
    const { name, value } = e.target;
    const fieldName = name as keyof UsuarioFormFields;

    setForm((prev: UsuarioFormFields) => ({
      ...prev,
      [name]: value,
    }));

    if (touched[fieldName]) {
      const error = validateField(fieldName, value);
      setErrors((prev) => ({
        ...prev,
        [fieldName]: error,
      }));
    }
  };



  const handleCargoChange = (e: SelectChangeEvent<number | "">) => {
    const { value } = e.target;
    const cargoId = value === "" ? undefined : Number(value);

    setForm((prev: UsuarioFormFields) => ({
      ...prev,
      cargoId: cargoId,
    }));

    if (touched.cargoId) {
      const error = validateField("cargoId", String(cargoId || ""));
      setErrors((prev) => ({
        ...prev,
        cargoId: error,
      }));
    }
  };

  const handleSectorChange = (e: SelectChangeEvent<string>) => {
    const { value } = e.target;
    const sectorId = value === "" ? undefined : Number(value);

    setForm((prev: UsuarioFormFields) => ({
      ...prev,
      sectorId: sectorId,
    }));

    if (touched.sectorId) {
      const error = validateField("sectorId", String(sectorId || ""));
      setErrors((prev) => ({
        ...prev,
        sectorId: error,
      }));
    }
  };

  const handleIsAdminUserChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;
    setIsAdminUser(checked);

    if (checked) {
      // Si se marca como administrador, limpiar la empresa y establecer rol
      setForm((prev: UsuarioFormFields) => ({
        ...prev,
        empresaId: 0,
        rol: "Administrador",
        maxUsuarios: 0,
        cantidadUsuarios: 0,
      }));

      // Limpiar errores de empresa y rol si existen
      setErrors((prev) => ({
        ...prev,
        empresaId: undefined,
        rol: undefined,
        maxUsuarios: undefined,
        cantidadUsuarios: undefined,
      }));
    } else {
      // Si se desmarca, limpiar el rol y validar empresa y rol si ya fueron tocados
      setForm((prev: UsuarioFormFields) => ({
        ...prev,
        rol: "",
      }));

      if (touched.empresaId) {
        const empresaError = validateField("empresaId", String(form.empresaId || ""));
        setErrors((prev) => ({
          ...prev,
          empresaId: empresaError,
        }));
      }
      if (touched.rol) {
        const rolError = validateField("rol", "");
        setErrors((prev) => ({
          ...prev,
          rol: rolError,
        }));
      }
    }
  };

  const handleShowPasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setShowPassword(event.target.checked);
  };

  const handleBlur = (fieldName: keyof UsuarioFormFields) => {
    setTouched((prev) => ({ ...prev, [fieldName]: true }));
    const error = validateField(fieldName, String(form[fieldName] ?? ""));
    setErrors((prev) => ({
      ...prev,
      [fieldName]: error,
    }));
  };

  // Llamada ARCA: usar useSWR con key null hasta completar 11 dígitos
  const { data: arcaData, isValidating: isLoadingArca, error: arcaError } = useSWR(
    arcaCUIL ? ArtAPI.getARCAURL({ CUIL: arcaCUIL }) : null,
    () => ArtAPI.getARCA({ CUIL: arcaCUIL }),
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  );

  const { data: sectores, isValidating: isLoadingSectores, error: sectoresError } = AuthAPI.useGetRefSectores();

  useEffect(() => {
    if (!arcaData) return;
    setForm(prev => ({
      ...prev,
      nombre: ([arcaData.nombre, arcaData.apellido].filter(Boolean).join(' ')) || prev.nombre,
      apellido: arcaData.apellido ?? prev.apellido,
      fechaNacimiento: arcaData.fechaNacimiento ? dayjs(arcaData.fechaNacimiento).format('DD/MM/YYYY') : prev.fechaNacimiento,
    }));
  }, [arcaData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Manejo directo para 'delete' (no requiere validación de formulario)
    if (isDeleting || isActivating) {
      const deleteData: UsuarioFormFields = {
        ...form,
        cuit: form.cuit.replace(/[^\d]/g, ""),
        userName: form.cuit.replace(/[^\d]/g, ""),        
      };
      onSubmit(deleteData);
      return;
    }

    // Set default values for hidden fields       
    // Determinar empresaId según si es administrador
    let finalEmpresaId = form.empresaId;
    if (isCreating && isAdminUser) {
      finalEmpresaId = 0; // Si es administrador, empresaId debe ser 0
    }

    const formDataWithDefaults = {
      ...form,
      cuit: form.cuit.replace(/[^\d]/g, ""), // Parse CUIT as integer, removing all non-digits
      userName: form.cuit.replace(/[^\d]/g, ""), // Use email as username
      tipo: "", // Default type
      rol: form.rol || (roles.length > 0 ? roles[0].nombre : ""), // Default to first role
      empresaId: finalEmpresaId,
      cargoId: isCreating && isAdminEmpleador ? 1 : form.cargoId,
    };

    // Mark all fields as touched
    const allTouched: TouchedFields = Object.keys(form).reduce((acc, key) => {
      acc[key as keyof TouchedFields] = true;
      return acc;
    }, {} as TouchedFields);
    setTouched(allTouched);

    if (validateAllFields()) {
      // console.log("Submitting form data:", formDataWithDefaults);
      // Limpiamos los campos de password/confirmPassword si están vacíos al editar
      const dataToSubmit = { ...formDataWithDefaults };
      if (isEditing && !dataToSubmit.password) {
        delete dataToSubmit.password;
        delete dataToSubmit.confirmPassword;
      }

      console.log("Submitting form data:", dataToSubmit);
      onSubmit(dataToSubmit);
    }
  };

  console.log("Form State:", form.empresaId);

  return (
    <CustomModal
      open={open}
      onClose={isSubmitting ? () => {} : handleModalCloseAttempt}
      title={modalTitle}
      size={isCreating || Boolean(form.id) ? "large" : "mid"}
    >
      <Box
        component="form"
        className={styles.formContainer}
        onSubmit={handleSubmit}
      >
        {errorMsg && (
          <Typography className={styles.errorMessage}>{errorMsg}</Typography>
        )}
        {awaitingEmpresaRelation && isEditing && (
          <Alert severity="warning" variant="outlined" sx={{ mb: 2 }}>
            <Typography
              component="div"
              variant="body1"
              sx={{ fontSize: "1.2rem", lineHeight: 1.5, fontWeight: 600 }}
            >
              {LEYENDA_ASOCIAR_EMPRESA_ANTES_DE_GUARDAR}
            </Typography>
          </Alert>
        )}
        <div className={styles.formLayout}>
          <div className={styles.formContent}>
            <div className={hasEmpresasTab ? styles.tabsStableHeight : undefined}>
              <CustomTabs
                currentTab={fichaTab}
                onTabChange={(_e, v) => setFichaTab(v)}
                tabs={[
                  {
                    label: "Datos del Usuario",
                    value: 0,
                    disabled: awaitingEmpresaRelation,
                    tooltip: awaitingEmpresaRelation
                      ? "Primero vincule al menos una empresa al usuario"
                      : undefined,
                    content: (
                      <>
            <div className={styles.formSection}>
              <Typography variant="h6" className={styles.sectionTitle}>
                Datos del Usuario
              </Typography>

              <div className={styles.formRow}>
                <TextField
                  label="Nombre/Apellido"
                  name="nombre"
                  value={form.nombre}
                  onChange={handleTextFieldChange}
                  onBlur={() => handleBlur("nombre")}
                  error={touched.nombre && !!errors.nombre}
                  helperText={touched.nombre && errors.nombre}
                  fullWidth
                  required={!isDisabled}
                  disabled={isDisabled}
                  placeholder="Ingrese nombre"
                />
              </div>

              {(isCreating || isEditing) && (
                <div className={styles.formRow}>
                  <TextField
                    label="Email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleTextFieldChange}
                    onBlur={() => handleBlur("email")}
                    error={touched.email && !!errors.email}
                    helperText={touched.email && errors.email}
                    fullWidth
                    required={!isDisabled}
                    disabled={isDisabled}
                    placeholder="ejemplo@empresa.com"
                    className={styles.fullRowField}
                  />
                </div>
              )}

              <div className={styles.formRow}>
                <TextField
                  label="CUIT/CUIL"
                  name="cuit"
                  value={form.cuit}
                  onChange={handleTextFieldChange}
                  onBlur={() => handleBlur("cuit")}
                  error={touched.cuit && !!errors.cuit}
                  helperText={touched.cuit && errors.cuit}
                  fullWidth
                  required={!isDisabled}
                  disabled={isDisabled}
                  placeholder="Ingrese CUIT (11 dígitos)"
                />
                <div className={styles.phoneField}>
                  <PhoneInput
                    country="ar"
                    value={form.phoneNumber}
                    onChange={(value) =>
                      setForm((prev: UsuarioFormFields) => ({
                        ...prev,
                        phoneNumber: value,
                      }))
                    }
                    onBlur={() => handleBlur("phoneNumber")}
                    disabled={isDisabled}
                    specialLabel="Teléfono"
                    containerClass={styles.phoneContainer}
                    inputClass={styles.phoneInput}
                    buttonClass={styles.phoneButton}
                    inputProps={{ name: "phoneNumber" }}
                  />
                  {touched.phoneNumber && errors.phoneNumber && (
                    <Typography variant="caption" color="error" sx={{ ml: 2, mt: 0.5 }}>
                      {errors.phoneNumber}
                    </Typography>
                  )}
                </div>
              </div>

              <div className={styles.formRow}>
                <FormControl
                  fullWidth
                  required={!isDisabled && !isAdminEmpleador}
                  error={touched.cargoId && !!errors.cargoId}
                  disabled={isDisabled}
                  sx={{ display: isAdminEmpleador ? 'none' : undefined }}
                >
                  <InputLabel>Cargo/Función</InputLabel>
                  <Select
                    name="cargoId"
                    value={form.cargoId || ""}
                    label="Cargo/Función..."
                    onChange={handleCargoChange}
                    onBlur={() => handleBlur("cargoId")}
                    displayEmpty
                  >
                    {cargos.map((cargo) => (
                      <MenuItem key={cargo.id} value={cargo.id}>
                        {cargo.descripcion}
                      </MenuItem>
                    ))}
                  </Select>
                  {touched.cargoId && errors.cargoId && (
                    <Typography
                      variant="caption"
                      color="error"
                      sx={{ ml: 2, mt: 0.5 }}
                    >
                      {errors.cargoId}
                    </Typography>
                  )}
                </FormControl>

                <FormControl
                  fullWidth
                  required={!isDisabled && !isAdminUser}
                  error={touched.rol && !!errors.rol && !isAdminUser}
                  disabled={isRolSelectDisabled}
                >
                  <InputLabel>Rol</InputLabel>
                  <Select
                    name="rol"
                    value={form.rol}
                    label="Rol"
                    onChange={handleSelectChange}
                    onBlur={() => handleBlur("rol")}
                  >
                    {roleOptions.map(({ rol, disabled }) => (
                      <MenuItem
                        key={rol.id}
                        value={rol.nombre}
                        disabled={disabled}
                        className={disabled ? styles.roleDisabled : undefined}
                      >
                        {rol.nombre}
                      </MenuItem>
                    ))}
                  </Select>
                  {touched.rol && errors.rol && !isAdminUser && (
                    <Typography
                      variant="caption"
                      color="error"
                      sx={{ ml: 2, mt: 0.5 }}
                    >
                      {errors.rol}
                    </Typography>
                  )}
                </FormControl>
                <FormControl
                  fullWidth
                  required={!isDisabled && !isAdminEmpleador}
                  error={touched.sectorId && !!errors.sectorId}
                  disabled={isDisabled}
                  sx={{ display: isAdminEmpleador ? 'none' : undefined }}
                >
                  <InputLabel>Sector</InputLabel>
                  <Select
                      name="sectorId"
                      value={form.sectorId ? String(form.sectorId) : ""}
                      label="Sector"
                      onChange={handleSectorChange}
                      onBlur={() => handleBlur("sectorId")}
                    >
                      {isLoadingSectores ? (
                        <MenuItem value="">
                          <em>Cargando...</em>
                        </MenuItem>
                      ) : sectores && sectores.length > 0 ? (
                        sectores.map((s) => (
                          <MenuItem key={s.id} value={String(s.id)}>
                            {s.descripcion}
                          </MenuItem>
                        ))
                      ) : (
                        <MenuItem value="">No hay sectores</MenuItem>
                      )}
                  </Select>
                  {touched.sectorId && errors.sectorId && (
                    <Typography
                      variant="caption"
                      color="error"
                      sx={{ ml: 2, mt: 0.5 }}
                    >
                      {errors.sectorId}
                    </Typography>
                  )}
                </FormControl>
              </div>

              <div className={styles.formRow} style={{ display: requiresTituloMatricula ? undefined : 'none' }}>
                <TextField
                  label="Título Habilitante"
                  name="titulo"
                  value={form.titulo || ""}
                  onChange={handleTextFieldChange}
                  onBlur={() => handleBlur("titulo")}
                  error={touched.titulo && !!errors.titulo}
                  helperText={touched.titulo && errors.titulo}
                  fullWidth
                  required={!isDisabled && requiresTituloMatricula}
                  disabled={isDisabled}
                />
                <TextField
                  label="Matrícula"
                  name="matricula"
                  value={form.matricula || ""}
                  onChange={handleTextFieldChange}
                  onBlur={() => handleBlur("matricula")}
                  error={touched.matricula && !!errors.matricula}
                  helperText={touched.matricula && errors.matricula}
                  fullWidth
                  required={!isDisabled && requiresTituloMatricula}
                  disabled={isDisabled}
                  inputProps={form.rol === "SeguridadEHigiene" ? undefined : { inputMode: 'numeric', pattern: '[0-9]*' }}
                />
              </div>

            </div>
            {isAdmin && (
              <FormControlLabel
                className={styles.checkboxInline}
                control={
                  <Checkbox
                    checked={isAdminUser}
                    onChange={handleIsAdminUserChange}
                    disabled={isDisabled}
                    color="primary"
                  />
                }
                label="Es Administrador"
              />
            )}

            {/* Credenciales de Acceso (Ocultas en View y Deleted)*/}
            {(isCreating || isEditing) && (
              <div className={styles.formSection}>
                <Typography variant="h6" className={styles.sectionTitle}>
                  Credenciales de Acceso
                </Typography>

                <div className={styles.formRow}>
                  <TextField
                    label={
                      isCreating
                        ? "Contraseña temporal"
                        : "Nueva contraseña (opcional)"
                    }
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={handleTextFieldChange}
                    onBlur={() => handleBlur("password")}
                    error={touched.password && !!errors.password}
                    helperText={touched.password && errors.password}
                    fullWidth
                    required={isCreating && !isDisabled}
                    disabled={isDisabled}
                    placeholder={
                      isCreating ? "••••••••" : "Dejar vacío para no cambiar"
                    }
                  />
                  <TextField
                    label={
                      isCreating
                        ? "Confirmar contraseña"
                        : "Confirmar nueva contraseña"
                    }
                    name="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    value={form.confirmPassword}
                    onChange={handleTextFieldChange}
                    onBlur={() => handleBlur("confirmPassword")}
                    error={
                      touched.confirmPassword && !!errors.confirmPassword
                    }
                    helperText={
                      touched.confirmPassword && errors.confirmPassword
                    }
                    fullWidth
                    required={isCreating && !isDisabled}
                    disabled={isDisabled}
                    placeholder={
                      isCreating ? "••••••••" : "Dejar vacío para no cambiar"
                    }
                  />

                  <div className={styles.showPasswordRow}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={showPassword}
                          onChange={handleShowPasswordChange}
                          disabled={isDisabled}
                          color="primary"
                        />
                      }
                      label="Mostrar contraseña"
                    />
                  </div>
                </div>

                <Typography variant="body2" className={styles.passwordHelp}>
                  {isCreating
                    ? "La contraseña debe tener al menos 8 caracteres, incluir mayúsculas, minúsculas y números."
                    : "Deje ambos campos vacíos para mantener la contraseña actual. Si desea cambiarla, complete ambos campos con la nueva contraseña."}
                </Typography>
              </div>
            )}
                      </>
                    ),
                  },
                  ...(hasEmpresasTab
                    ? [
                        {
                          label: "Empresas del Usuario",
                          value: 1,
                          disabled: empresasTabDisabled,
                          tooltip: "Primero registre el usuario",
                          content: (
                            <>
                              {awaitingEmpresaRelation && (
                                <Typography
                                  variant="body1"
                                  color="warning.main"
                                  sx={{ mb: 2, fontSize: "1.2rem", lineHeight: 1.5, fontWeight: 600 }}
                                >
                                  {LEYENDA_ASOCIAR_EMPRESA_ANTES_DE_GUARDAR}
                                </Typography>
                              )}
                              <UsuarioEmpresasUsuarioTab
                                open={open}
                                usuarioId={String(form.id ?? "")}
                                cuitForm={form.cuit}
                                puedeEditar={isEditing}
                                empresasIniciales={usuarios.find((u) => String(u.id) === String(form.id))?.empresas}
                                onEmpresasRelacionadasMetaChange={handleEmpresasRelacionadasMetaChange}
                                onMutate={onEmpresaMutate}
                              />
                            </>
                          ),
                        },
                      ]
                    : []),
                ]}
              />
            </div>
            <div className={styles.formActions}>
              {/* Botón de acción principal (Oculto en 'view') */}
              {!isViewing && (
                <CustomButton
                  type="submit"
                  disabled={isSubmitting || (isEditing && mustBlockModalClose)}
                  style={{
                    opacity: isSubmitting ? 0.7 : 1,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <CircularProgress size={20} color="inherit" sx={{ mr: 1 }} />
                      {isEditing ? "Guardando..."
                        : isDeleting ? "Procesando..."
                          : isActivating ? "Activando..."
                            : "Registrando..."}
                    </>
                  ) : (
                    <>
                      {isEditing ? "Guardar Cambios"
                        : isDeleting ? "Dar de baja Usuario"
                          : isActivating ? "Activar Usuario"
                            : "Registrar Usuario"}
                    </>
                  )}
                </CustomButton>
              )}

              <CustomButton
                onClick={handleModalCloseAttempt}
                color="secondary"
                disabled={isSubmitting}
                style={{
                  opacity: isSubmitting ? 0.7 : 1,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer'
                }}
              >
                {isViewing ? "Cerrar" : "Cancelar"}
              </CustomButton>
            </div>
          </div>
          {isCreating && (
            <div className={styles.infoColumn}>
              <div className={styles.infoPanel}>
                <Typography variant="h6" className={styles.infoPanelTitle}>
                  Información Importante
                </Typography>
                <ul className={styles.infoList}>
                  <li>El usuario recibirá un email para activar su cuenta</li>
                  <li>La contraseña temporal deberá ser cambiada</li>
                  <li>Posteriormente se podrán configurar los permisos</li>
                  <li>Los campos marcados con * son obligatorios</li>
                  {rolRequiereEmpresa && (
                  <li>
                    Tras registrar, use la solapa &quot;Empresas del Usuario&quot;: debe asociar al menos una
                    empresa antes de guardar cambios o cerrar el asistente.
                  </li>
                  )}
                </ul>
              </div>

              <div className={styles.infoPanel}>
                <Typography variant="h6" className={styles.infoPanelTitle}>
                  Información de ARCA
                </Typography>
                <div style={{ marginTop: 8 }}>
                  {isLoadingArca ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CircularProgress size={18} />
                      <Typography variant="body2">Consultando ARCA...</Typography>
                    </div>
                  ) : arcaError ? (
                    <Typography variant="body2" color="error">No se pudo consultar ARCA</Typography>
                  ) : arcaData ? (
                    <ul className={styles.infoList}>
                      <li><strong>Nombre:</strong> {arcaData.nombre || ''}</li>
                      <li><strong>Apellido:</strong> {arcaData.apellido || ''}</li>
                      <li><strong>Fecha de Nac.:</strong> {arcaData.fechaNacimiento ? dayjs(arcaData.fechaNacimiento).format('DD/MM/YYYY') : ''}</li>
                    </ul>
                  ) : (
                    <ul className={styles.infoList}>
                      <li><strong>Nombre:</strong> </li>
                      <li><strong>Apellido:</strong> </li>
                      <li><strong>Fecha de Nac.:</strong> </li>
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </Box>
      <CustomModalMessage
        open={modalMsgOpen}
        onClose={() => setModalMsgOpen(false)}
        message={modalMsgText}
        type={modalMsgType}
        title="Atención"
      />
    </CustomModal>
  );
}
