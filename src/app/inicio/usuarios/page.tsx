"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Typography,
  TextField,
  MenuItem,
} from "@mui/material";
import { MdExpandMore } from "react-icons/md";
import { BsSliders } from "react-icons/bs";
import UsuarioForm, {
  type UsuarioFormFields,
  LEYENDA_ASOCIAR_EMPRESA_ANTES_DE_GUARDAR,
} from "./UsuarioForm";
import UsuarioTable from "./UsuarioTable";
import EmpresaTable from "./EmpresaTable";
import Tareas from "./Tareas";
import useUsuarios from "./useUsuarios";
import { type UsuarioUpdatePayload } from "@/data/usuarioAPI";
import { useEmpresasStore } from "@/data/empresasStore";
import CustomSelectSearch from "@/utils/ui/form/CustomSelectSearch";
import {
  Empresa,
  USUARIOS_EMPRESAS_USUARIO_LOGUEADO_PAGE_SIZE,
} from "@/data/authAPI";
import { useSearchParams } from "next/navigation";
import Formato from "@/utils/Formato";
import styles from "./Usuario.module.css";
import CustomButton from "@/utils/ui/button/CustomButton";
import CustomModalMessage from "@/utils/ui/message/CustomModalMessage";
import UsuarioRow from "./interfaces/UsuarioRow";
import { useAuth } from "@/data/AuthContext";
import IUsuarioDarDeBajaReactivar from "./interfaces/IUsuarioDarDeBajaReactivar";
import CustomTabs from "@/utils/ui/tab/CustomTab";
import { isAdministradorTodasEmpresasRole } from "@/utils/rolesUtils";

/** Valor sentinela en `Empresa.empresaId` para la opción "Todas las Empresas" en el listado de usuarios. */
const EMPRESA_TODAS_EMPRESAS_ID = -1;

const EMPRESA_OPCION_TODAS: Empresa = {
  empresaId: EMPRESA_TODAS_EMPRESAS_ID,
  cuit: 0,
  razonSocial: "Todas las Empresas",
  domicilio: "",
  localidad: "",
  provincia: "",
};

type RequestMethod =
  | "create"
  | "edit"
  | "view"
  | "delete"
  | "activate"
  | "remove";

interface RequestState {
  method: RequestMethod | null;
  userData: UsuarioFormFields | null;
}

interface PermisosModulo {
  moduloId: number;
  moduloDescripcion: string;
  habilitado: boolean;
  tareas: {
    tareaId: number;
    moduloId: number;
    habilitada: boolean;
  }[];
}

function buildUsuarioUpdatePayload(data: UsuarioFormFields): UsuarioUpdatePayload {
  return {
    phoneNumber: String(data.phoneNumber ?? "").trim(),
    nombre: String(data.nombre ?? "").trim(),
    titulo: String(data.titulo ?? "").trim(),
    matricula: String(data.matricula ?? "").trim(),
    sectorId: Number(data.sectorId ?? 0),
    cargoId: Number(data.cargoId ?? 0),
    ...(data.password ? { password: String(data.password) } : {}),
    ...(data.confirmPassword ? { confirmPassword: String(data.confirmPassword) } : {}),
    email: String(data.email ?? "").trim(),
    rol: String(data.rol ?? ""),
  };
}

export default function UsuariosPage() {
  const { user, hasTask } = useAuth();
  const canConfigEmpresa = hasTask("Usuarios_EmpresaConfiguracion");
  
  // Determinar si el usuario es administrador
  const isAdmin = user?.rol?.toLowerCase() === "administrador";
  const isAdminTodasEmpresas = isAdministradorTodasEmpresasRole(user?.rol);
  const initialForm: UsuarioFormFields = {
    cuit: "",
    email: "",
    password: "",
    confirmPassword: "",
    rol: "",
    // tipo: "",
    phoneNumber: "",
    nombre: "",
    userName: "",
    titulo: "",
    matricula: "",
    maxUsuarios: 0,
    // Usamos el `|| 1` como valor por defecto, aunque es mejor que el backend lo maneje si no existe
    empresaId: user?.empresaId || 0, 
    cargoId: undefined,
    sectorId: undefined,
  };

  const { empresas, isLoading: isLoadingEmpresas } = useEmpresasStore();
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState<Empresa | null>(null);
  const seleccionAutomaticaRef = useRef(false);
  const [bloquearBusquedaPorCuit, setBloquearBusquedaPorCuit] = useState(false);
  const searchParams = useSearchParams();
  const cuitQuery = searchParams?.get("cuit") ?? searchParams?.get("cuil");
  const cuitForzado = cuitQuery ? Number(String(cuitQuery).replace(/\D/g, "")) : NaN;

  const empresasIdsStore = useMemo(
    () =>
      Array.from(
        new Set(
          empresas
            .map((e) => Number(e.empresaId))
            .filter((id) => Number.isFinite(id) && id > 0)
        )
      ).sort((a, b) => a - b),
    [empresas]
  );

  const opcionesEmpresaSelector = useMemo(
    () => (empresas.length === 1 ? empresas : [EMPRESA_OPCION_TODAS, ...empresas]),
    [empresas]
  );

  useEffect(() => {
    if (Number.isFinite(cuitForzado) && cuitForzado > 0) return;
    if (isLoadingEmpresas) return;
    if (empresas.length === 1) {
      setEmpresaSeleccionada(empresas[0]);
      seleccionAutomaticaRef.current = true;
      return;
    }
    if (empresas.length === 0) {
      setEmpresaSeleccionada(null);
      seleccionAutomaticaRef.current = false;
      return;
    }
    setEmpresaSeleccionada((prev) => {
      if (!seleccionAutomaticaRef.current && prev !== null) return prev;
      return EMPRESA_OPCION_TODAS;
    });
    seleccionAutomaticaRef.current = true;
  }, [empresas, isLoadingEmpresas, cuitForzado]);

  useEffect(() => {
    if (isLoadingEmpresas) return;
    const hasCuitForzado = Number.isFinite(cuitForzado) && cuitForzado > 0;
    setBloquearBusquedaPorCuit(hasCuitForzado);
    if (!hasCuitForzado) return;
    const match = empresas.find((e) => {
      const digits = Number(String((e as any)?.cuit ?? "").replace(/\D/g, ""));
      return Number.isFinite(digits) && digits === cuitForzado;
    });
    if (match) {
      setEmpresaSeleccionada(match);
      seleccionAutomaticaRef.current = true;
    }
  }, [cuitForzado, empresas, isLoadingEmpresas]);

  const handleEmpresaChange = (_event: React.SyntheticEvent, newValue: Empresa | null) => {
    if (bloquearBusquedaPorCuit) return;
    setEmpresaSeleccionada(newValue);
    seleccionAutomaticaRef.current = false;
  };

  const getEmpresaLabel = (empresa: Empresa | null): string => {
    if (!empresa) return "";
    if (empresa.empresaId === EMPRESA_TODAS_EMPRESAS_ID) return "Todas las Empresas";
    if (bloquearBusquedaPorCuit) return String((empresa as any)?.razonSocial ?? "");
    const cuitFormateado = Formato.CUIP((empresa as any)?.cuit);
    return `${(empresa as any)?.razonSocial ?? ""} - ${cuitFormateado}`;
  };

  const porEmpresaIdsListado = useMemo(() => {
    if (!empresaSeleccionada) return [];
    if (empresaSeleccionada.empresaId === EMPRESA_TODAS_EMPRESAS_ID) {
      if (isAdminTodasEmpresas) return [];
      return empresasIdsStore;
    }
    return [empresaSeleccionada.empresaId];
  }, [empresaSeleccionada, isAdminTodasEmpresas, empresasIdsStore]);

  const consultarGetAllSinEmpresaId =
    isAdminTodasEmpresas &&
    empresaSeleccionada?.empresaId === EMPRESA_TODAS_EMPRESAS_ID;

  const porEmpresaIdsListadoKey = useMemo(() => {
    if (consultarGetAllSinEmpresaId) return "todas";
    return porEmpresaIdsListado.slice().sort((a, b) => a - b).join(",");
  }, [porEmpresaIdsListado, consultarGetAllSinEmpresaId]);

  const [usuariosPageIndex, setUsuariosPageIndex] = useState(1);

  useEffect(() => {
    setUsuariosPageIndex(1);
  }, [porEmpresaIdsListadoKey]);

  const emptyFilter = { cuit: "", nombre: "", email: "", rol: "", estado: "" };
  const [filterDraft, setFilterDraft] = useState(emptyFilter);
  const [filterCommitted, setFilterCommitted] = useState(emptyFilter);

  const handleBuscar = () => {
    setUsuariosPageIndex(1);
    setFilterCommitted(filterDraft);
  };
  const handleLimpiar = () => {
    setFilterDraft(emptyFilter);
    setFilterCommitted(emptyFilter);
    setUsuariosPageIndex(1);
  };

  const {
    usuarios,
    usuariosListadoMeta,
    roles,
    cargos,
    refEmpleadores,
    loading,
    error,
    registrarUsuario,
    actualizarPermisosUsuario,
    usuarioUpdate,
    usuarioDarDeBaja,
    usuarioReactivar,
    usuarioReestablecer,
    usuarioReenviarCorreo,
    mutateUsuarios,
  } = useUsuarios({
    porEmpresaIds: porEmpresaIdsListado,
    allowEmptyEmpresasPost: consultarGetAllSinEmpresaId,
    pageIndex: usuariosPageIndex,
    pageSize: USUARIOS_EMPRESAS_USUARIO_LOGUEADO_PAGE_SIZE,
    ...filterCommitted,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  /** Tras alta exitosa con id: el modal exige al menos una empresa antes de cerrar. */
  const [awaitingEmpresaAfterCreate, setAwaitingEmpresaAfterCreate] = useState(false);
  const [requestState, setRequestState] = useState<RequestState>({
    method: null,
    userData: null,
  });
  const [currentTab, setCurrentTab] = useState<number>(0);

  useEffect(() => {
    if (!canConfigEmpresa && currentTab === 1) {
      setCurrentTab(0);
    }
  }, [canConfigEmpresa, currentTab]);

  const [permisosModal, setPermisosModal] = useState<{
    open: boolean;
    usuario: UsuarioRow | null;
  }>({
    open: false,
    usuario: null,
  });

  const [modalMessage, setModalMessage] = useState<{
    open: boolean;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    secondaryMessage?: string;
    title?: string;
  }>({
    open: false,
    message: '',
    type: 'info'
  });

  // Determina si el modal debe estar visible
  const showModal = requestState.method !== null;

  const showModalMessage = (
    message: string,
    type: 'success' | 'error' | 'warning' | 'info',
    secondaryMessage?: string,
    title?: string
  ) => {
    setModalMessage({
      open: true,
      message,
      type,
      secondaryMessage: secondaryMessage ?? undefined,
      title,
    });
  };

  const handleClose = () => {
    setModalMessage({
      open: false,
      message: '',
      type: 'info',
      secondaryMessage: undefined,
    });
  };

  const handleEmpresaRelationSatisfied = useCallback(() => {
    setAwaitingEmpresaAfterCreate(false);
  }, []);

  const handleOpenModal = (method: RequestMethod, row?: UsuarioRow) => {
    setAwaitingEmpresaAfterCreate(false);
    // CORRECCIÓN 2: Mapeamos la fila (UsuarioRow) a datos del formulario (UsuarioFormFields)
    const sectorIdFromRow = row?.sectorId ?? (row as UsuarioRow & { SectorId?: number | string } | undefined)?.SectorId;
    const resolvedSectorId =
      sectorIdFromRow !== undefined && sectorIdFromRow !== null && sectorIdFromRow !== ""
        ? Number(sectorIdFromRow)
        : undefined;

    const dataToForm: UsuarioFormFields = row
      ? {
          cuit: row.cuit || "",
          email: row.email || "",
          // La contraseña y su confirmación deben ir vacías SIEMPRE en edición
          password: method === "edit" ? "" : "",
          confirmPassword: method === "edit" ? "" : "",
          rol: row.rol || "",
          phoneNumber: row.phoneNumber || "",
          nombre: row.nombre || "",
          cargoId: row.cargoId || 1,
          userName: row.userName || "",
          titulo: row.titulo || "",
          matricula: row.matricula || "",
          // Limpiar cargo si está vacío, es null, undefined, o contiene valores no deseados
          // cargo: (row.cargo && row.cargo.trim() !== "" && row.cargo !== "null" && row.cargo !== "undefined") ? row.cargo : "",
          // Mantenemos la empresaId de la fila o del usuario actual
          empresaId: row.empresaId || user?.empresaId || 0, 
          sectorId: resolvedSectorId,
          // Es crucial incluir el ID de usuario para edición/eliminación
          id: String(row.id), // <-- Aseguramos que el ID se convierte a string para el formulario
        }
      : initialForm;

    setRequestState({
      method,
      userData: dataToForm,
    });
    setFormError(null);
  };

  const handleCloseModal = () => {
    setAwaitingEmpresaAfterCreate(false);
    setRequestState({ method: null, userData: null });
  };

  const handleOpenPermisos = (usuario: UsuarioRow) => {
    setPermisosModal({
      open: true,
      usuario,
    });
  };

  const handleClosePermisos = () => {
    setPermisosModal({
      open: false,
      usuario: null,
    });
  };

  const handleSavePermisos = async (permisos: PermisosModulo[]) => {
    if (!permisosModal.usuario?.id) {
      showModalMessage("Error: No se pudo identificar el usuario", "error");
      return;
    }

    try {
      const result = await actualizarPermisosUsuario(
        String(permisosModal.usuario.id),
        permisos
      );

      if (result.success) {
        showModalMessage("Permisos guardados exitosamente", "success");
        handleClosePermisos();
      } else {
        showModalMessage(`Error al guardar permisos: ${result.error}`, "error");
      }
    } catch (error) {
      console.error("Error al guardar permisos:", error);
      showModalMessage("Ocurrió un error al guardar los permisos", "error");
    }
  };

  const handleReestablecer = async (row: UsuarioRow): Promise<void> => {
    try {
      const result = await usuarioReestablecer(String(row.email));
      if (result.success) {
        showModalMessage(
          "Se envió el correo para reestablecer la contraseña del usuario.",
          "success"
        );
      } else {
        showModalMessage(`Error al reestablecer usuario: ${result.error}`, "error");
      }
    } catch (error) {
      showModalMessage("Ocurrió un error al reestablecer el usuario", "error");
    }
  };

  const handleReenviarCorreo = async (row: UsuarioRow): Promise<void> => {
    try {
      const result = await usuarioReenviarCorreo(String(row.email));
      if (result.success) {
        showModalMessage("Se reenviaron las instrucciones al correo del usuario.", "success");
      } else {
        showModalMessage(`Error al reenviar correo: ${result.error}`, "error");
      }
    } catch (error) {
      showModalMessage("Ocurrió un error al reenviar el correo", "error");
    }
  };

const handleSubmit = async (data: UsuarioFormFields) => {
  // Activar estado de carga
  setIsSubmitting(true);
  setFormError(null);

  try {
    // Aquí se crea el objeto completo para la API, añadiendo empresaId
    // La lógica de envío debe considerar el modo (create, edit, delete)
    const method = requestState.method;
    let successSecondaryMessage: string | undefined;
    let result: { success: boolean; error: string | null } = {
      success: false,
      error: null,
    };

    if (method === "view") {
      handleCloseModal();
      return;
    }

  // Aquí se crea el objeto completo para la API...
  const dataToSubmit = {
    ...data,
    // EmpresaId ya viene del formulario o de initialForm, aseguramos que se envíe
    empresaId: data.empresaId || initialForm.empresaId,
    // Si es 'edit' o 'delete', el ID viene en `data`
  };

  // TODO: Implementar lógica de API para EDITAR y ELIMINAR
  if (method === "edit") {
    // Lógica para editar usuario
    {
      const rawResult = await usuarioUpdate(
        String(data.id),
        buildUsuarioUpdatePayload(dataToSubmit)
      );
      result = {
        success: rawResult.success,
        error: rawResult.error !== undefined ? rawResult.error : null,
      };
    }
  } else if (method === "activate") {
    // Lógica para reactivar usuario
    const reactivarBody: IUsuarioDarDeBajaReactivar = {
      id: String(data.id),
      deletedObs: "", // data.deletedObs || ""
    };
    {
      const rawResult = await usuarioReactivar(reactivarBody);
      result = {
        success: rawResult.success,
        error: rawResult.error !== undefined ? String(rawResult.error) : null,
      };
    }
  } else if (method === "delete") {
    // Lógica para eliminar usuario
    const darDeBajaBody: IUsuarioDarDeBajaReactivar = {
      id: String(data.id),
      deletedObs: "", // data.deletedObs || ""
    };
    {
      const rawResult = await usuarioDarDeBaja(darDeBajaBody);
      result = {
        success: rawResult.success,
        error: rawResult.error !== undefined ? String(rawResult.error) : null,
      };
    }
  } else if (method === "create") {
    const createResult = (await registrarUsuario(dataToSubmit)) as {
      success: boolean;
      error: string | null;
      data?: { id?: number | string };
    };
    result = {
      success: createResult.success,
      error: createResult.error,
    };
    if (createResult.success) {
      const createdUserId = createResult.data?.id;
      const rolObj = roles.find(r => r.nombre === dataToSubmit.rol || r.nombreNormalizado === dataToSubmit.rol);
      const rolRequiereEmpresa =
        rolObj?.nombreNormalizado?.toLowerCase() === "administradorempleador" ||
        roles.find(r => r.nombreNormalizado?.toLowerCase() === "administradorempleador")?.rolesHijos.some(h => h.id === rolObj?.id);
      if (createdUserId !== undefined && createdUserId !== null && rolRequiereEmpresa) {
        setAwaitingEmpresaAfterCreate(true);
        successSecondaryMessage = LEYENDA_ASOCIAR_EMPRESA_ANTES_DE_GUARDAR;
        setRequestState({
          method: "edit",
          userData: {
            ...dataToSubmit,
            id: String(createdUserId),
          },
        });
      } else {
        setAwaitingEmpresaAfterCreate(false);
      }
    }
  }

    if (result.success) {
      const successTitles = {
        create: "Usuario creado exitosamente",
        edit: "Usuario actualizado exitosamente", 
        delete: "Usuario dado de baja exitosamente",
        activate: "Usuario reactivado exitosamente"
      };

      const successBodyMessages = {
        create: "Usuario Registrado",
        edit: "Usuario Actualizado",
        delete: "Usuario dado de baja",
        activate: "Usuario Reactivado"
      };

      const baseSuccessTitle = successTitles[method as keyof typeof successTitles] || "Operación completada exitosamente";
      const defaultSuccessMessage =
        successBodyMessages[method as keyof typeof successBodyMessages] ||
        "Operación completada";
      const modalTitleToShow = successSecondaryMessage
        ? defaultSuccessMessage
        : baseSuccessTitle;
      const modalMessageToShow = successSecondaryMessage
        ? successSecondaryMessage
        : defaultSuccessMessage;
      showModalMessage(modalMessageToShow, "success", undefined, modalTitleToShow);
      if (method !== "create" || !successSecondaryMessage) {
        handleCloseModal();
      }
    } else {
      const rawError = result.error || `Error al ${method} el usuario.`;
      const isInvalidEmailError =
        /Mailbox.*does not exist|does not exist.*Mailbox/i.test(rawError) ||
        /5\.1\.1/.test(rawError) ||
        /4\.4\.5/.test(rawError) ||
        /Directory harvest attack/i.test(rawError);
      const errorMessage = isInvalidEmailError
        ? "El email registrado no existe. Por favor inserte un email válido."
        : rawError;
      showModalMessage(errorMessage, "error");
      setFormError(errorMessage);
    }
  } catch (error) {
    console.error("Error en handleSubmit:", error);
    const errorMessage = "Ocurrió un error inesperado al procesar la solicitud";
    showModalMessage(errorMessage, "error");
    setFormError(errorMessage);
  } finally {
    // Desactivar estado de carga
    setIsSubmitting(false);
  }
};



  if (error) {
    return (
      <Typography color="error">
        Error:{" "}
        {error instanceof Error
          ? error.message
          : "Un error inesperado ha ocurrido."}
      </Typography>
    );
  }

  // AHORA currentInitialData siempre será UsuarioFormFields o initialForm
  // Lo cual satisface la prop initialData de UsuarioForm
  const currentInitialData = requestState.userData || initialForm; // LÍNEA 144

  const tabs = [
    {
      label: "Configuracion de Usuario",
      value: 0,
      content: (
        <>
          <CustomButton
            onClick={() => handleOpenModal("create")}
            style={{ float: "right" }}
          >
            Crear usuario
          </CustomButton>

          {/* Selector empresa*/}
          <Box className={styles.empresaSelectorWrapper}>
            <Box className={styles.empresaSelectorBox}>
              <CustomSelectSearch<Empresa>
                options={opcionesEmpresaSelector}
                getOptionLabel={getEmpresaLabel}
                value={empresaSeleccionada}
                onChange={handleEmpresaChange}
                label="Seleccionar Empresa"
                placeholder="Buscar empresa..."
                loading={isLoadingEmpresas}
                loadingText="Cargando empresas..."
                noOptionsText={
                  isLoadingEmpresas
                    ? "Cargando..."
                    : opcionesEmpresaSelector.length <= 1
                      ? "No hay empresas disponibles"
                      : "No se encontraron empresas"
                }
                disabled={isLoadingEmpresas || bloquearBusquedaPorCuit}
                isOptionEqualToValue={(option, value) => option?.empresaId === value?.empresaId}
              />
            </Box>
          </Box>

          <Accordion className={styles.accordion}>
            <AccordionSummary expandIcon={<MdExpandMore className={styles.accordionIcon} />}>
              <div className={styles.accordionSummaryContent}>
                <BsSliders size={20} />
                <Typography className={styles.accordionTitle}>Configuración de Filtros</Typography>
              </div>
            </AccordionSummary>
            <AccordionDetails>
              <div className={styles.filterRow}>
                <TextField label="CUIT" value={filterDraft.cuit.replace(/\D/g, "").length === 11 ? Formato.CUIP(filterDraft.cuit) : filterDraft.cuit} onChange={e => setFilterDraft(p => ({ ...p, cuit: e.target.value.replace(/\D/g, "").slice(0, 11) }))} className={styles.filterFieldCuit} />
                <TextField label="Nombre" value={filterDraft.nombre} onChange={e => setFilterDraft(p => ({ ...p, nombre: e.target.value }))} className={styles.filterFieldNombre} />
                <TextField label="Email" value={filterDraft.email} onChange={e => setFilterDraft(p => ({ ...p, email: e.target.value }))} className={styles.filterFieldEmail} />
                <TextField select label="Rol" value={filterDraft.rol} onChange={e => setFilterDraft(p => ({ ...p, rol: e.target.value }))} className={styles.filterFieldCombo}>
                  <MenuItem value="">Todos</MenuItem>
                  {(roles ?? []).map(r => <MenuItem key={r.id} value={r.nombre}>{r.nombre}</MenuItem>)}
                </TextField>
                <TextField select label="Estado" value={filterDraft.estado} onChange={e => setFilterDraft(p => ({ ...p, estado: e.target.value }))} className={styles.filterFieldCombo}>
                  <MenuItem value="">Todos</MenuItem>
                  {["Activo", "Inactivo", "Pendiente activación"].map(e => <MenuItem key={e} value={e}>{e}</MenuItem>)}
                </TextField>
                <CustomButton onClick={handleBuscar}>Buscar</CustomButton>
                <CustomButton onClick={handleLimpiar}>Limpiar</CustomButton>
              </div>
            </AccordionDetails>
          </Accordion>

          <UsuarioTable
            data={usuarios}
            onEdit={(row) => handleOpenModal("edit", row)}
            onView={(row) => handleOpenModal("view", row)}
            onDelete={(row) => handleOpenModal("delete", row)}
            onActivate={(row) => handleOpenModal("activate", row)}
            onRemove={(row) => handleOpenModal("remove", row)}
            onReestablecer={(row) => handleReestablecer(row)}
            onPermisos={handleOpenPermisos}
            onReenviarCorreo={handleReenviarCorreo}
            isLoading={loading}
            serverPagination={
              porEmpresaIdsListado.length > 0 || consultarGetAllSinEmpresaId
                ? {
                    pageIndex: usuariosPageIndex,
                    pageSize: USUARIOS_EMPRESAS_USUARIO_LOGUEADO_PAGE_SIZE,
                    pageCount: Math.max(1, usuariosListadoMeta?.pages ?? 1),
                    onPageChange: setUsuariosPageIndex,
                  }
                : undefined
            }
          />
        </>
      ),
    },
    ...(canConfigEmpresa
      ? [
          {
            label: "Configuracion de Empresa",
            value: 1,
            content: <EmpresaTable />,
          },
        ]
      : []),
  ];
  
  return (
    <Box className={styles.usuariosPageContainer}>
      <CustomTabs
        tabs={tabs}
        currentTab={currentTab}
        onTabChange={(_event, newTabValue) => setCurrentTab(newTabValue)}
      />

      <UsuarioForm
        open={showModal}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        roles={roles}
        cargos={cargos}
        refEmpleadores={refEmpleadores}
        usuarios={usuarios}
        initialData={currentInitialData}
        errorMsg={formError}
        method={requestState.method || "create"}
        isAdmin={isAdmin}
        isSubmitting={isSubmitting}
        awaitingEmpresaRelation={awaitingEmpresaAfterCreate}
        onEmpresaRelationSatisfied={handleEmpresaRelationSatisfied}
        onEmpresaMutate={mutateUsuarios}
      />

      <Tareas
        open={permisosModal.open}
        onClose={handleClosePermisos}
        usuario={permisosModal.usuario}
        onSave={handleSavePermisos}
      />

      <CustomModalMessage         
        open={modalMessage.open}         
        message={modalMessage.message}         
        type={modalMessage.type}         
        onClose={handleClose}        
        title={modalMessage.title}
        secondaryMessage={modalMessage.secondaryMessage}
      />
    </Box>
  );
}
