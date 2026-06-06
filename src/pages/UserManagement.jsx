import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  prepareImportScanPayload,
  ensureImportTagsForRows,
  validateImportRows,
  getPendingImportTags,
  formatPendingImportTagsSummary,
  isSupportedImportFile,
  IMPORT_FILE_ACCEPT,
  IMPORT_FILE_LABEL,
} from '@/lib/user-import';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/PageHeader';
import PageShell from '@/components/PageShell';
import SectionLoader from '@/components/SectionLoader';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { BadgeCheck, Users, Plus, UserCog, Shield, Crown, Search, ChevronDown, Upload, FileText, Sparkles, Eye, EyeOff, Pencil, Trash2, Info } from 'lucide-react';

/**
 * @typedef {Object} CreateUserPayload
 * @property {string} email
 * @property {string} fullName
 * @property {string} password
 * @property {string} role
 * @property {string | null} [departmentId]
 * @property {string | null} [designationId]
 * @property {string} [admin_id]
 */

/**
 * @typedef {Object} AssignAdminPayload
 * @property {string} userId
 * @property {string | null} admin_id
 */

/**
 * @typedef {Object} UpdateUserProfilePayload
 * @property {string} userId
 * @property {string} role
 * @property {string | null} departmentId
 * @property {string | null} designationId
 */

/**
 * @typedef {Object} BulkImportUsersPayload
 * @property {Array<{
 *   fullName: string,
 *   email: string,
 *   department: string,
 *   designation: string,
 *   departmentId: string | null,
 *   designationId: string | null,
 * }>} rows
 * @property {string} password
 * @property {string} role
 */

const PAGE_SIZE = 10;
const BULK_NO_CHANGE = '__no_change__';

const EMPTY_BULK_EDIT = {
  role: BULK_NO_CHANGE,
  department_id: BULK_NO_CHANGE,
  designation_id: BULK_NO_CHANGE,
  admin_id: BULK_NO_CHANGE,
};

const EMPTY_FORM = {
  email: '',
  fullName: '',
  password: '',
  role: 'staff',
  admin_id: '',
  department_id: '',
  designation_id: '',
};

function userLabel(user) {
  return user?.full_name || user?.email || 'Unnamed user';
}

function roleLabel(role) {
  if (role === 'superuser') return 'Super User';
  if (role === 'admin') return 'Admin';
  if (role === 'staff') return 'Staff';
  return role || '—';
}

function isStaffDesignation(designation) {
  return designation.name.trim().toLowerCase() === 'staff';
}

function sortByName(users) {
  return [...users].sort((a, b) =>
    (a.full_name || a.email || '').localeCompare(b.full_name || b.email || ''),
  );
}

function matchesUserSearch(user, query, usersById) {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  const parts = [
    user.full_name,
    user.email,
    user.id,
    user.role === 'staff' && user.admin_id ? userLabel(usersById[user.admin_id]) : '',
  ].filter(Boolean);
  return parts.some((part) => part.toLowerCase().includes(q));
}

function TableSearch({ value, onChange, placeholder }) {
  return (
    <div className="relative w-full sm:w-72">
      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <Input
        placeholder={placeholder}
        className="pl-9 bg-background border-border text-foreground"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/**
 * @param {{
 *   checked: boolean,
 *   indeterminate?: boolean,
 *   onCheckedChange: (checked: boolean | 'indeterminate') => void,
 *   ariaLabel: string,
 * }} props
 */
function UserSelectionCheckbox({ checked, indeterminate = false, onCheckedChange, ariaLabel }) {
  return (
    <Checkbox
      checked={indeterminate ? 'indeterminate' : checked}
      onCheckedChange={onCheckedChange}
      aria-label={ariaLabel}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    />
  );
}

function UserProfileExpandPanel({
  draftRole,
  draftDepartmentId,
  draftDesignationId,
  onRoleChange,
  onDepartmentChange,
  onDesignationChange,
  onSave,
  isSaving,
  sortedDepartments,
  sortedDesignations,
}) {
  return (
    <div className="px-4 pb-4 pt-2 bg-muted/10 border-t border-border">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
        App Persona &amp; Profile
      </p>
      <div className="grid sm:grid-cols-3 gap-4 max-w-3xl">
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Role</label>
          <Select value={draftRole} onValueChange={onRoleChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="staff">Staff</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="superuser">Super User</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">The persona this user uses in the app.</p>
        </div>
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Department</label>
          <Select value={draftDepartmentId} onValueChange={onDepartmentChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select a department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {sortedDepartments.map((department) => (
                <SelectItem key={department.id} value={department.id}>
                  {department.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Designation</label>
          <Select value={draftDesignationId} onValueChange={onDesignationChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select a designation" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {sortedDesignations.map((designation) => (
                <SelectItem key={designation.id} value={designation.id}>
                  {designation.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={onSave} disabled={isSaving} size="sm">
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}

function TablePagination({ page, totalPages, totalItems, onPageChange }) {
  if (totalItems <= PAGE_SIZE) return null;

  const safePage = Math.min(page, totalPages);
  const rangeStart = (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, totalItems);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-t border-border bg-muted/20">
      <p className="text-xs text-muted-foreground">
        Showing {rangeStart}–{rangeEnd} of {totalItems} users
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          disabled={safePage === 1}
        >
          Previous
        </Button>
        <span className="text-xs font-medium text-muted-foreground min-w-[3rem] text-center">
          {safePage} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          disabled={safePage === totalPages}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

function UserTableSection({ title, description, icon: Icon, search, children }) {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="w-4 h-4 text-primary flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        {search}
      </div>
      {children}
    </div>
  );
}

function PasswordField({ id, value, onChange, placeholder, className }) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative">
      <Input
        id={id}
        type={showPassword ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={`pr-10 ${className || ''}`}
        autoComplete="new-password"
      />
      <button
        type="button"
        onClick={() => setShowPassword((prev) => !prev)}
        className="absolute right-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        aria-label={showPassword ? 'Hide password' : 'Show password'}
      >
        {showPassword ? (
          <EyeOff className="h-4 w-4 shrink-0" aria-hidden="true" />
        ) : (
          <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

export default function UserManagement() {
  const { data: currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [assignTarget, setAssignTarget] = useState(null);
  const [selectedAdminId, setSelectedAdminId] = useState('');
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [draftRole, setDraftRole] = useState('staff');
  const [draftDepartmentId, setDraftDepartmentId] = useState('none');
  const [draftDesignationId, setDraftDesignationId] = useState('none');
  const [superuserSearch, setSuperuserSearch] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [adminSearch, setAdminSearch] = useState('');
  const [superuserPage, setSuperuserPage] = useState(1);
  const [staffPage, setStaffPage] = useState(1);
  const [adminPage, setAdminPage] = useState(1);
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importPassword, setImportPassword] = useState('');
  const [importRole, setImportRole] = useState('staff');
  const [importError, setImportError] = useState('');
  const [importFileName, setImportFileName] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [isAiScanning, setIsAiScanning] = useState(false);
  const [aiScanComplete, setAiScanComplete] = useState(false);
  const [aiScanSummary, setAiScanSummary] = useState('');
  const [pendingTagsSummary, setPendingTagsSummary] = useState('');
  const [importSuccessOverlay, setImportSuccessOverlay] = useState('');
  const [isImportDragging, setIsImportDragging] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [bulkEditForm, setBulkEditForm] = useState(EMPTY_BULK_EDIT);
  const importFileRef = useRef(null);
  const importFileStateRef = useRef(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    enabled: currentUser?.role === 'superuser',
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list(),
    enabled: currentUser?.role === 'superuser',
  });

  const { data: designations = [] } = useQuery({
    queryKey: ['designations'],
    queryFn: () => base44.entities.Designation.list(),
    enabled: currentUser?.role === 'superuser',
  });

  const superuserUsers = useMemo(
    () => sortByName(users.filter((user) => user.role === 'superuser')),
    [users],
  );

  const adminUsers = useMemo(
    () => sortByName(users.filter((user) => user.role === 'admin')),
    [users],
  );

  const staffUsers = useMemo(
    () => sortByName(users.filter((user) => user.role === 'staff')),
    [users],
  );

  const usersById = useMemo(
    () => Object.fromEntries(users.map((user) => [user.id, user])),
    [users],
  );

  const departmentsById = useMemo(
    () => Object.fromEntries(departments.map((dept) => [dept.id, dept])),
    [departments],
  );

  const designationsById = useMemo(
    () => Object.fromEntries(designations.map((item) => [item.id, item])),
    [designations],
  );

  const sortedDepartments = useMemo(
    () => [...departments].sort((a, b) => a.name.localeCompare(b.name)),
    [departments],
  );

  const sortedDesignations = useMemo(
    () => [...designations]
      .filter((designation) => !isStaffDesignation(designation))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [designations],
  );

  const filteredSuperuserUsers = useMemo(
    () => superuserUsers.filter((user) => matchesUserSearch(user, superuserSearch, usersById)),
    [superuserUsers, superuserSearch, usersById],
  );

  const filteredStaffUsers = useMemo(
    () => staffUsers.filter((user) => matchesUserSearch(user, staffSearch, usersById)),
    [staffUsers, staffSearch, usersById],
  );

  const filteredAdminUsers = useMemo(
    () => adminUsers.filter((user) => matchesUserSearch(user, adminSearch, usersById)),
    [adminUsers, adminSearch, usersById],
  );

  const superuserTotalPages = Math.max(1, Math.ceil(filteredSuperuserUsers.length / PAGE_SIZE));
  const staffTotalPages = Math.max(1, Math.ceil(filteredStaffUsers.length / PAGE_SIZE));
  const adminTotalPages = Math.max(1, Math.ceil(filteredAdminUsers.length / PAGE_SIZE));
  const safeSuperuserPage = Math.min(superuserPage, superuserTotalPages);
  const safeStaffPage = Math.min(staffPage, staffTotalPages);
  const safeAdminPage = Math.min(adminPage, adminTotalPages);

  const paginatedSuperuserUsers = useMemo(() => {
    const start = (safeSuperuserPage - 1) * PAGE_SIZE;
    return filteredSuperuserUsers.slice(start, start + PAGE_SIZE);
  }, [filteredSuperuserUsers, safeSuperuserPage]);

  const paginatedStaffUsers = useMemo(() => {
    const start = (safeStaffPage - 1) * PAGE_SIZE;
    return filteredStaffUsers.slice(start, start + PAGE_SIZE);
  }, [filteredStaffUsers, safeStaffPage]);

  const paginatedAdminUsers = useMemo(() => {
    const start = (safeAdminPage - 1) * PAGE_SIZE;
    return filteredAdminUsers.slice(start, start + PAGE_SIZE);
  }, [filteredAdminUsers, safeAdminPage]);

  const validImportRows = useMemo(
    () => importRows.filter((row) => row.valid),
    [importRows],
  );

  const selectedUsers = useMemo(
    () => users.filter((user) => selectedUserIds.includes(user.id)),
    [users, selectedUserIds],
  );

  const deletableSelectedUserIds = useMemo(
    () => selectedUserIds.filter((userId) => userId !== currentUser?.id),
    [selectedUserIds, currentUser?.id],
  );

  const staffCountByAdmin = useMemo(() => {
    const counts = {};
    for (const user of users) {
      if (user.role === 'staff' && user.admin_id) {
        counts[user.admin_id] = (counts[user.admin_id] || 0) + 1;
      }
    }
    return counts;
  }, [users]);

  const createUser = useMutation({
    /** @param {CreateUserPayload} payload */
    mutationFn: async (payload) => {
      const created = await base44.entities.User.create(payload);
      return created;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      closeForm();
    },
  });

  const assignAdmin = useMutation({
    /** @param {AssignAdminPayload} variables */
    mutationFn: async ({ userId, admin_id }) => {
      return base44.entities.User.update(userId, { admin_id: admin_id || null });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      closeAssignDialog();
    },
  });

  const bulkImportUsers = useMutation({
    /**
     * @param {BulkImportUsersPayload} variables
     */
    mutationFn: async (variables) => {
      const { rows, password, role } = variables;
      const [freshDepartments, freshDesignations] = await Promise.all([
        base44.entities.Department.list(),
        base44.entities.Designation.list(),
      ]);

      const findDepartmentByName = async (name) => {
        const key = name.trim().toLowerCase();
        const cached = freshDepartments.find((item) => item.name.trim().toLowerCase() === key);
        if (cached) return cached;
        const latest = await base44.entities.Department.list();
        return latest.find((item) => item.name.trim().toLowerCase() === key) || null;
      };

      const findDesignationByName = async (name) => {
        const key = name.trim().toLowerCase();
        const cached = freshDesignations.find((item) => item.name.trim().toLowerCase() === key);
        if (cached) return cached;
        const latest = await base44.entities.Designation.list();
        return latest.find((item) => item.name.trim().toLowerCase() === key) || null;
      };

      const tagContext = await ensureImportTagsForRows(rows, freshDepartments, freshDesignations, {
        createDepartment: (data) => base44.entities.Department.create(data),
        createDesignation: (data) => base44.entities.Designation.create(data),
        findDepartmentByName,
        findDesignationByName,
      });
      const validatedRows = validateImportRows(rows, {
        departments: tagContext.departments,
        designations: tagContext.designations,
      }).filter((row) => row.valid);

      const result = { created: 0, failed: [], createdTags: tagContext };
      for (const row of validatedRows) {
        try {
          await base44.entities.User.create({
            email: row.email.trim(),
            fullName: row.fullName.trim(),
            password,
            role,
            departmentId: row.departmentId,
            designationId: row.designationId,
          });
          result.created += 1;
        } catch (error) {
          result.failed.push({
            email: row.email,
            message: error instanceof Error ? error.message : 'Create failed',
          });
        }
      }
      return result;
    },
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['users'] }),
        queryClient.invalidateQueries({ queryKey: ['departments'] }),
        queryClient.invalidateQueries({ queryKey: ['designations'] }),
      ]);

      if (result.created > 0) {
        closeImport();
        const failedNote = result.failed.length
          ? ` ${result.failed.length} could not be created.`
          : '';
        setImportSuccessOverlay(
          `Successfully created ${result.created} user${result.created === 1 ? '' : 's'}.${failedNote}`,
        );
        return;
      }

      setImportResult(result);
      setImportError('No users were created. Check the preview for errors and try again.');
    },
  });

  useEffect(() => {
    if (!importSuccessOverlay) return undefined;
    const timer = window.setTimeout(() => setImportSuccessOverlay(''), 2000);
    return () => window.clearTimeout(timer);
  }, [importSuccessOverlay]);

  const updateUserProfile = useMutation({
    /** @param {UpdateUserProfilePayload} variables */
    mutationFn: async ({ userId, role, departmentId, designationId }) => {
      return base44.entities.User.update(userId, {
        role,
        departmentId,
        designationId,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const bulkUpdateUsers = useMutation({
    /** @param {{ userIds: string[], updates: Record<string, string | null>, adminId?: string | null | undefined }} variables */
    mutationFn: async (variables) => {
      const { userIds, updates, adminId } = variables;
      for (const userId of userIds) {
        /** @type {Record<string, string | null>} */
        const payload = { ...updates };
        const targetUser = users.find((item) => item.id === userId);
        if (adminId !== undefined) {
          if (targetUser?.role === 'staff') {
            payload.admin_id = adminId;
          }
        }
        await base44.entities.User.update(userId, payload);
      }
      return userIds.length;
    },
    onSuccess: async (updatedCount) => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowBulkEdit(false);
      setBulkEditForm(EMPTY_BULK_EDIT);
      setSelectedUserIds([]);
      toast.success(`Updated ${updatedCount} user${updatedCount === 1 ? '' : 's'}.`);
    },
  });

  const bulkDeleteUsers = useMutation({
    /** @param {string[]} userIds */
    mutationFn: async (userIds) => {
      const result = { deleted: 0, failed: [] };
      for (const userId of userIds) {
        try {
          await base44.entities.User.delete(userId);
          result.deleted += 1;
        } catch (error) {
          result.failed.push({
            userId,
            message: error instanceof Error ? error.message : 'Delete failed',
          });
        }
      }
      return result;
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowBulkDelete(false);
      setSelectedUserIds([]);
      setExpandedUserId(null);
      if (result.deleted > 0) {
        toast.success(`Deleted ${result.deleted} user${result.deleted === 1 ? '' : 's'}.`);
      }
      if (result.failed.length > 0) {
        toast.error(`${result.failed.length} user${result.failed.length === 1 ? '' : 's'} could not be deleted.`);
      }
    },
  });

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openImport = () => {
    setShowImport(true);
    setImportRows([]);
    setImportPassword('');
    setImportRole('staff');
    setImportError('');
    setImportFileName('');
    setImportResult(null);
    setIsAiScanning(false);
    setAiScanComplete(false);
    setAiScanSummary('');
    setPendingTagsSummary('');
    setIsImportDragging(false);
    importFileStateRef.current = null;
  };

  const closeImport = () => {
    setShowImport(false);
    setImportRows([]);
    setImportPassword('');
    setImportRole('staff');
    setImportError('');
    setImportFileName('');
    setImportResult(null);
    setIsAiScanning(false);
    setAiScanComplete(false);
    setAiScanSummary('');
    setPendingTagsSummary('');
    setIsImportDragging(false);
    importFileStateRef.current = null;
    if (importFileRef.current) importFileRef.current.value = '';
  };

  const selectImportFile = (file) => {
    if (!isSupportedImportFile(file)) {
      setImportError(`Unsupported file type. Upload a ${IMPORT_FILE_LABEL} file.`);
      return;
    }

    importFileStateRef.current = file;
    setImportFileName(file.name);
    setImportRows([]);
    setImportError('');
    setImportResult(null);
    setAiScanComplete(false);
    setAiScanSummary('');
    setPendingTagsSummary('');
  };

  const handleImportFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) selectImportFile(file);
  };

  const handleImportDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isAiScanning && !bulkImportUsers.isPending) {
      setIsImportDragging(true);
    }
  };

  const handleImportDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsImportDragging(false);
  };

  const handleImportDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsImportDragging(false);
    if (isAiScanning || bulkImportUsers.isPending) return;

    const file = event.dataTransfer.files?.[0];
    if (file) selectImportFile(file);
  };

  const handleAiScan = async () => {
    const file = importFileStateRef.current;
    if (!file) {
      setImportError(`Choose a ${IMPORT_FILE_LABEL} file before scanning.`);
      return;
    }

    setIsAiScanning(true);
    setImportError('');
    setImportResult(null);
    setAiScanComplete(false);
    setAiScanSummary('');
    setPendingTagsSummary('');
    setImportRows([]);

    try {
      const scanPayload = await prepareImportScanPayload(file);
      const scanResult = await base44.ai.scanUserImport(scanPayload);

      const validated = validateImportRows(scanResult.users, {
        departments,
        designations,
        allowPendingTags: true,
      });

      const pendingTags = getPendingImportTags(scanResult.users, departments, designations);
      const pendingSummary = formatPendingImportTagsSummary(pendingTags);

      setImportRows(validated);
      setAiScanComplete(true);
      setAiScanSummary(scanResult.summary || `Found ${scanResult.users.length} users.`);
      setPendingTagsSummary(pendingSummary);

      const readyCount = validated.filter((row) => row.valid).length;
      if (!readyCount) {
        setImportError(
          'Scan finished, but no users are ready to import. Check missing fields or invalid rows.',
        );
        toast.error('Scan complete, but no users are ready to import.');
      } else {
        toast.success(`Scan complete. ${readyCount} user${readyCount === 1 ? '' : 's'} ready to import.`);
      }
    } catch (error) {
      setImportRows([]);
      setAiScanComplete(false);
      const message = error instanceof Error ? error.message : 'AI document scan failed.';
      setImportError(message);
      toast.error(message);
    } finally {
      setIsAiScanning(false);
    }
  };

  const handleBulkImport = () => {
    if (!importPassword.trim() || validImportRows.length === 0) return;
    bulkImportUsers.mutate({
      rows: validImportRows,
      password: importPassword,
      role: importRole,
    });
  };

  const closeForm = () => {
    setShowForm(false);
    setForm(EMPTY_FORM);
  };

  const openAssignDialog = (staffUser) => {
    setAssignTarget(staffUser);
    setSelectedAdminId(staffUser.admin_id || 'none');
  };

  const closeAssignDialog = () => {
    setAssignTarget(null);
    setSelectedAdminId('');
  };

  const toggleUserExpand = (user) => {
    if (expandedUserId === user.id) {
      setExpandedUserId(null);
      return;
    }
    setExpandedUserId(user.id);
    setDraftRole(user.role || 'staff');
    setDraftDepartmentId(user.department_id || 'none');
    setDraftDesignationId(user.designation_id || 'none');
  };

  const handleSubmit = () => {
    if (!form.email.trim() || !form.password.trim()) return;
    /** @type {CreateUserPayload} */
    const payload = {
      email: form.email.trim(),
      fullName: form.fullName.trim(),
      password: form.password,
      role: form.role,
    };
    if (form.department_id) {
      payload.departmentId = form.department_id;
    }
    if (form.designation_id) {
      payload.designationId = form.designation_id;
    }
    if (form.role === 'staff' && form.admin_id) {
      payload.admin_id = form.admin_id;
    }
    createUser.mutate(payload);
  };

  const handleAssign = () => {
    if (!assignTarget) return;
    assignAdmin.mutate({
      userId: assignTarget.id,
      admin_id: selectedAdminId === 'none' ? null : selectedAdminId,
    });
  };

  const handleSaveProfile = (userId) => {
    updateUserProfile.mutate({
      userId,
      role: draftRole,
      departmentId: draftDepartmentId === 'none' ? null : draftDepartmentId,
      designationId: draftDesignationId === 'none' ? null : draftDesignationId,
    });
  };

  const isUserSelected = (userId) => selectedUserIds.includes(userId);

  const toggleUserSelection = (userId, checked) => {
    setSelectedUserIds((current) => {
      if (checked) {
        return current.includes(userId) ? current : [...current, userId];
      }
      return current.filter((id) => id !== userId);
    });
  };

  const togglePageSelection = (pageUserIds, checked) => {
    setSelectedUserIds((current) => {
      if (!checked) {
        return current.filter((id) => !pageUserIds.includes(id));
      }
      const next = new Set(current);
      pageUserIds.forEach((id) => next.add(id));
      return [...next];
    });
  };

  const clearSelection = () => {
    setSelectedUserIds([]);
    setExpandedUserId(null);
  };

  const getPageSelectionState = (pageUsers) => {
    const pageUserIds = pageUsers.map((user) => user.id);
    const selectedOnPage = pageUserIds.filter((id) => selectedUserIds.includes(id));
    return {
      pageUserIds,
      allSelected: pageUserIds.length > 0 && selectedOnPage.length === pageUserIds.length,
      someSelected: selectedOnPage.length > 0 && selectedOnPage.length < pageUserIds.length,
    };
  };

  const openBulkEditDialog = () => {
    setBulkEditForm(EMPTY_BULK_EDIT);
    setShowBulkEdit(true);
  };

  const closeBulkEditDialog = () => {
    setShowBulkEdit(false);
    setBulkEditForm(EMPTY_BULK_EDIT);
  };

  const handleBulkEditSubmit = () => {
    /** @type {Record<string, string | null>} */
    const updates = {};
    /** @type {string | null | undefined} */
    let adminId = undefined;

    if (bulkEditForm.role !== BULK_NO_CHANGE) updates.role = bulkEditForm.role;
    if (bulkEditForm.department_id !== BULK_NO_CHANGE) {
      updates.department_id = bulkEditForm.department_id === 'none' ? null : bulkEditForm.department_id;
    }
    if (bulkEditForm.designation_id !== BULK_NO_CHANGE) {
      updates.designation_id = bulkEditForm.designation_id === 'none' ? null : bulkEditForm.designation_id;
    }
    if (bulkEditForm.admin_id !== BULK_NO_CHANGE) {
      adminId = bulkEditForm.admin_id === 'none' ? null : bulkEditForm.admin_id;
    }

    if (!Object.keys(updates).length && adminId === undefined) {
      toast.error('Choose at least one field to update.');
      return;
    }

    const staffSelectedCount = selectedUsers.filter((item) => item.role === 'staff').length;
    if (adminId !== undefined && staffSelectedCount === 0) {
      toast.error('Admin assignment only applies to staff users. Select at least one staff member.');
      return;
    }

    bulkUpdateUsers.mutate({ userIds: selectedUserIds, updates, adminId });
  };

  const handleBulkDelete = () => {
    if (!deletableSelectedUserIds.length) {
      toast.error('You cannot delete your own account.');
      return;
    }
    bulkDeleteUsers.mutate(deletableSelectedUserIds);
  };

  if (currentUser?.role !== 'superuser') {
    return (
      <PageShell>
        <p className="text-center text-muted-foreground">Access restricted to super users.</p>
      </PageShell>
    );
  }

  const staffHeader = (
    <div className="grid grid-cols-[40px_1.2fr_1.2fr_1fr_1fr_0.8fr_1fr_120px] gap-4 px-4 py-3 border-b border-border bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wide items-center">
      <UserSelectionCheckbox
        checked={getPageSelectionState(paginatedStaffUsers).allSelected}
        indeterminate={getPageSelectionState(paginatedStaffUsers).someSelected}
        onCheckedChange={(checked) => togglePageSelection(getPageSelectionState(paginatedStaffUsers).pageUserIds, checked === true)}
        ariaLabel="Select all staff on this page"
      />
      <span>Name</span>
      <span>Email</span>
      <span>Department</span>
      <span>Designation</span>
      <span>Role</span>
      <span>Assigned Admin</span>
      <span>Actions</span>
    </div>
  );

  const superuserHeader = (
    <div className="grid grid-cols-[40px_1.2fr_1.2fr_1fr_1fr_0.8fr_120px] gap-4 px-4 py-3 border-b border-border bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wide items-center">
      <UserSelectionCheckbox
        checked={getPageSelectionState(paginatedSuperuserUsers).allSelected}
        indeterminate={getPageSelectionState(paginatedSuperuserUsers).someSelected}
        onCheckedChange={(checked) => togglePageSelection(getPageSelectionState(paginatedSuperuserUsers).pageUserIds, checked === true)}
        ariaLabel="Select all super users on this page"
      />
      <span>Name</span>
      <span>Email</span>
      <span>Department</span>
      <span>Designation</span>
      <span>Role</span>
      <span>Staff Assigned</span>
    </div>
  );

  const adminHeader = (
    <div className="grid grid-cols-[40px_1.2fr_1.2fr_1fr_1fr_0.8fr_120px] gap-4 px-4 py-3 border-b border-border bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wide items-center">
      <UserSelectionCheckbox
        checked={getPageSelectionState(paginatedAdminUsers).allSelected}
        indeterminate={getPageSelectionState(paginatedAdminUsers).someSelected}
        onCheckedChange={(checked) => togglePageSelection(getPageSelectionState(paginatedAdminUsers).pageUserIds, checked === true)}
        ariaLabel="Select all admins on this page"
      />
      <span>Name</span>
      <span>Email</span>
      <span>Department</span>
      <span>Designation</span>
      <span>Role</span>
      <span>Staff Assigned</span>
    </div>
  );

  return (
    <PageShell>
      <PageHeader
        title="User Management"
        description="Create super users, admins, and staff. Assign staff to admins who will manage their work."
        icon={Users}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={openImport} className="gap-2">
              <Upload className="w-4 h-4" />
              Import Users
            </Button>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="w-4 h-4" />
              New User
            </Button>
          </div>
        }
      />

      {isLoading ? <SectionLoader label="Loading users..." /> : null}

      {selectedUserIds.length > 0 ? (
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
          <p className="text-sm font-medium text-foreground">
            {selectedUserIds.length} user{selectedUserIds.length === 1 ? '' : 's'} selected
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={clearSelection}>
              Clear Selection
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={openBulkEditDialog}>
              <Pencil className="w-3.5 h-3.5" />
              Edit Selected
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={() => setShowBulkDelete(true)}
              disabled={deletableSelectedUserIds.length === 0}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Selected
            </Button>
          </div>
        </div>
      ) : null}

      <div className="space-y-6">
        <UserTableSection
          title="Super Users"
          description="Click a super user to expand and edit their role, department, and designation."
          icon={Crown}
          search={
            <TableSearch
              value={superuserSearch}
              onChange={(value) => {
                setSuperuserSearch(value);
                setSuperuserPage(1);
                setExpandedUserId(null);
              }}
              placeholder="Search super users..."
            />
          }
        >
          {superuserHeader}
          <div className="divide-y divide-border">
            {paginatedSuperuserUsers.map((user) => {
              const isExpanded = expandedUserId === user.id;
              const isSelected = isUserSelected(user.id);
              return (
                <div key={user.id} className={isExpanded || isSelected ? 'bg-muted/10' : ''}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleUserExpand(user)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleUserExpand(user);
                      }
                    }}
                    className="grid grid-cols-[40px_1.2fr_1.2fr_1fr_1fr_0.8fr_120px] gap-4 px-4 py-3 items-center hover:bg-muted/20 transition-colors cursor-pointer"
                  >
                    <UserSelectionCheckbox
                      checked={isSelected}
                      onCheckedChange={(checked) => toggleUserSelection(user.id, checked === true)}
                      ariaLabel={`Select ${userLabel(user)}`}
                    />
                    <div className="flex items-center gap-2 min-w-0">
                      <ChevronDown
                        className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      />
                      <p className="font-medium text-foreground truncate">{userLabel(user)}</p>
                    </div>
                    <span className="text-sm text-muted-foreground truncate">{user.email}</span>
                    <span className="text-sm text-muted-foreground truncate">
                      {departmentsById[user.department_id]?.name || '—'}
                    </span>
                    <span className="text-sm text-muted-foreground truncate">
                      {designationsById[user.designation_id]?.name || '—'}
                    </span>
                    <span className="inline-flex w-fit items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-500/10 text-violet-700 dark:text-violet-300">
                      {roleLabel(user.role)}
                    </span>
                    <span className="text-sm text-muted-foreground">—</span>
                  </div>
                  {isExpanded ? (
                    <UserProfileExpandPanel
                      draftRole={draftRole}
                      draftDepartmentId={draftDepartmentId}
                      draftDesignationId={draftDesignationId}
                      onRoleChange={setDraftRole}
                      onDepartmentChange={setDraftDepartmentId}
                      onDesignationChange={setDraftDesignationId}
                      onSave={() => handleSaveProfile(user.id)}
                      isSaving={updateUserProfile.isPending}
                      sortedDepartments={sortedDepartments}
                      sortedDesignations={sortedDesignations}
                    />
                  ) : null}
                </div>
              );
            })}
            {superuserUsers.length === 0 && !isLoading && (
              <div className="text-center py-10">
                <Crown className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="font-medium text-foreground">No super users yet</p>
                <p className="text-muted-foreground text-sm">Create a super user to manage the system.</p>
              </div>
            )}
            {superuserUsers.length > 0 && filteredSuperuserUsers.length === 0 && !isLoading && (
              <div className="text-center py-10">
                <Search className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="font-medium text-foreground">No super users match your search</p>
                <p className="text-muted-foreground text-sm">Try a different name or email.</p>
              </div>
            )}
          </div>
          <TablePagination
            page={safeSuperuserPage}
            totalPages={superuserTotalPages}
            totalItems={filteredSuperuserUsers.length}
            onPageChange={(nextPage) => {
              setSuperuserPage(nextPage);
              setExpandedUserId(null);
            }}
          />
        </UserTableSection>

        <UserTableSection
          title="Staff Users"
          description="Click a staff member to expand and edit their role, department, and designation, or use Assign to link them to an admin."
          icon={Users}
          search={
            <TableSearch
              value={staffSearch}
              onChange={(value) => {
                setStaffSearch(value);
                setStaffPage(1);
                setExpandedUserId(null);
              }}
              placeholder="Search staff..."
            />
          }
        >
          {staffHeader}
          <div className="divide-y divide-border">
            {paginatedStaffUsers.map((user) => {
              const isExpanded = expandedUserId === user.id;
              const isSelected = isUserSelected(user.id);
              return (
                <div key={user.id} className={isExpanded || isSelected ? 'bg-muted/10' : ''}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleUserExpand(user)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleUserExpand(user);
                      }
                    }}
                    className="grid grid-cols-[40px_1.2fr_1.2fr_1fr_1fr_0.8fr_1fr_120px] gap-4 px-4 py-3 items-center hover:bg-muted/20 transition-colors cursor-pointer"
                  >
                    <UserSelectionCheckbox
                      checked={isSelected}
                      onCheckedChange={(checked) => toggleUserSelection(user.id, checked === true)}
                      ariaLabel={`Select ${userLabel(user)}`}
                    />
                    <div className="flex items-center gap-2 min-w-0">
                      <ChevronDown
                        className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      />
                      <p className="font-medium text-foreground truncate">{userLabel(user)}</p>
                    </div>
                    <span className="text-sm text-muted-foreground truncate">{user.email}</span>
                    <span className="text-sm text-muted-foreground truncate">
                      {departmentsById[user.department_id]?.name || '—'}
                    </span>
                    <span className="text-sm text-muted-foreground truncate">
                      {designationsById[user.designation_id]?.name || '—'}
                    </span>
                    <span className="inline-flex w-fit items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground">
                      {roleLabel(user.role)}
                    </span>
                    <div className="text-sm text-muted-foreground">
                      {user.admin_id ? (
                        <p className="truncate text-foreground">{userLabel(usersById[user.admin_id])}</p>
                      ) : (
                        <p className="text-amber-600 dark:text-amber-400">Not assigned</p>
                      )}
                    </div>
                    <div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          openAssignDialog(user);
                        }}
                      >
                        <UserCog className="w-3.5 h-3.5" />
                        Assign
                      </Button>
                    </div>
                  </div>
                  {isExpanded ? (
                    <UserProfileExpandPanel
                      draftRole={draftRole}
                      draftDepartmentId={draftDepartmentId}
                      draftDesignationId={draftDesignationId}
                      onRoleChange={setDraftRole}
                      onDepartmentChange={setDraftDepartmentId}
                      onDesignationChange={setDraftDesignationId}
                      onSave={() => handleSaveProfile(user.id)}
                      isSaving={updateUserProfile.isPending}
                      sortedDepartments={sortedDepartments}
                      sortedDesignations={sortedDesignations}
                    />
                  ) : null}
                </div>
              );
            })}
            {staffUsers.length === 0 && !isLoading && (
              <div className="text-center py-10">
                <BadgeCheck className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="font-medium text-foreground">No staff users yet</p>
                <p className="text-muted-foreground text-sm">Create a staff user to get started.</p>
              </div>
            )}
            {staffUsers.length > 0 && filteredStaffUsers.length === 0 && !isLoading && (
              <div className="text-center py-10">
                <Search className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="font-medium text-foreground">No staff users match your search</p>
                <p className="text-muted-foreground text-sm">Try a different name or email.</p>
              </div>
            )}
          </div>
          <TablePagination
            page={safeStaffPage}
            totalPages={staffTotalPages}
            totalItems={filteredStaffUsers.length}
            onPageChange={(nextPage) => {
              setStaffPage(nextPage);
              setExpandedUserId(null);
            }}
          />
        </UserTableSection>

        <UserTableSection
          title="Admin Users"
          description="Click an admin to expand and edit their role, department, and designation."
          icon={Shield}
          search={
            <TableSearch
              value={adminSearch}
              onChange={(value) => {
                setAdminSearch(value);
                setAdminPage(1);
                setExpandedUserId(null);
              }}
              placeholder="Search admins..."
            />
          }
        >
          {adminHeader}
          <div className="divide-y divide-border">
            {paginatedAdminUsers.map((user) => {
              const isExpanded = expandedUserId === user.id;
              const isSelected = isUserSelected(user.id);
              return (
                <div key={user.id} className={isExpanded || isSelected ? 'bg-muted/10' : ''}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleUserExpand(user)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleUserExpand(user);
                      }
                    }}
                    className="grid grid-cols-[40px_1.2fr_1.2fr_1fr_1fr_0.8fr_120px] gap-4 px-4 py-3 items-center hover:bg-muted/20 transition-colors cursor-pointer"
                  >
                    <UserSelectionCheckbox
                      checked={isSelected}
                      onCheckedChange={(checked) => toggleUserSelection(user.id, checked === true)}
                      ariaLabel={`Select ${userLabel(user)}`}
                    />
                    <div className="flex items-center gap-2 min-w-0">
                      <ChevronDown
                        className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      />
                      <p className="font-medium text-foreground truncate">{userLabel(user)}</p>
                    </div>
                    <span className="text-sm text-muted-foreground truncate">{user.email}</span>
                    <span className="text-sm text-muted-foreground truncate">
                      {departmentsById[user.department_id]?.name || '—'}
                    </span>
                    <span className="text-sm text-muted-foreground truncate">
                      {designationsById[user.designation_id]?.name || '—'}
                    </span>
                    <span className="inline-flex w-fit items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                      {roleLabel(user.role)}
                    </span>
                    <span className="inline-flex w-fit items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground">
                      {staffCountByAdmin[user.id] || 0} staff
                    </span>
                  </div>
                  {isExpanded ? (
                    <UserProfileExpandPanel
                      draftRole={draftRole}
                      draftDepartmentId={draftDepartmentId}
                      draftDesignationId={draftDesignationId}
                      onRoleChange={setDraftRole}
                      onDepartmentChange={setDraftDepartmentId}
                      onDesignationChange={setDraftDesignationId}
                      onSave={() => handleSaveProfile(user.id)}
                      isSaving={updateUserProfile.isPending}
                      sortedDepartments={sortedDepartments}
                      sortedDesignations={sortedDesignations}
                    />
                  ) : null}
                </div>
              );
            })}
            {adminUsers.length === 0 && !isLoading && (
              <div className="text-center py-10">
                <Shield className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="font-medium text-foreground">No admin users yet</p>
                <p className="text-muted-foreground text-sm">Create an admin user to manage staff.</p>
              </div>
            )}
            {adminUsers.length > 0 && filteredAdminUsers.length === 0 && !isLoading && (
              <div className="text-center py-10">
                <Search className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="font-medium text-foreground">No admin users match your search</p>
                <p className="text-muted-foreground text-sm">Try a different name or email.</p>
              </div>
            )}
          </div>
          <TablePagination
            page={safeAdminPage}
            totalPages={adminTotalPages}
            totalItems={filteredAdminUsers.length}
            onPageChange={(nextPage) => {
              setAdminPage(nextPage);
              setExpandedUserId(null);
            }}
          />
        </UserTableSection>
      </div>

      <Dialog open={showImport} onOpenChange={(open) => (open ? setShowImport(true) : closeImport())}>
        <DialogContent className="max-w-xl max-h-[80dvh] flex flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="flex-shrink-0 px-4 pt-4 pb-3">
            <DialogTitle>Import Users</DialogTitle>
            <DialogDescription>
              Upload or drag and drop a {IMPORT_FILE_LABEL} file, then use Scan with AI for the most accurate results before creating users.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 space-y-4 pb-4">
            {importFileName && !aiScanComplete && !isAiScanning ? (
              <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">Use Scan with AI for better accuracy</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your document is ready. Click <span className="font-medium text-foreground">Scan with AI</span> so the app can read names, emails, departments, and designations more reliably before you create users.
                  </p>
                </div>
              </div>
            ) : null}

            {!importFileName ? (
              <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 flex items-start gap-3">
                <Info className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  After you upload a document, use the <span className="font-medium text-foreground">Scan with AI</span> button for better accuracy when extracting user details.
                </p>
              </div>
            ) : null}

            <div
              className={`rounded-lg border border-dashed p-4 transition-colors ${
                isImportDragging
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-muted/20'
              }`}
              onDragEnter={handleImportDragOver}
              onDragOver={handleImportDragOver}
              onDragLeave={handleImportDragLeave}
              onDrop={handleImportDrop}
            >
              <input
                ref={importFileRef}
                type="file"
                accept={IMPORT_FILE_ACCEPT}
                className="hidden"
                onChange={handleImportFileChange}
              />
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <FileText className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">Upload document</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Drag and drop a {IMPORT_FILE_LABEL} file here, or click Choose File. Photos and scans are supported with AI.
                    </p>
                    {isImportDragging ? (
                      <p className="text-xs font-medium text-primary mt-2">Drop your document here</p>
                    ) : null}
                    {importFileName && !isImportDragging ? (
                      <p className="text-xs text-foreground mt-2 truncate">{importFileName}</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => importFileRef.current?.click()}
                    disabled={isAiScanning || bulkImportUsers.isPending}
                  >
                    <Upload className="w-4 h-4" />
                    Choose File
                  </Button>
                  <Button
                    className="gap-2"
                    onClick={handleAiScan}
                    disabled={!importFileName || isAiScanning || bulkImportUsers.isPending}
                  >
                    <Sparkles className="w-4 h-4" />
                    {isAiScanning ? 'Scanning...' : 'Scan with AI'}
                  </Button>
                </div>
              </div>
              {isAiScanning ? (
                <p className="text-xs text-muted-foreground mt-3">
                  AI is reading your document in the background. You will be notified when scanning is complete.
                </p>
              ) : null}
              {aiScanComplete && aiScanSummary ? (
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 mt-3">
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{aiScanSummary}</p>
                  {pendingTagsSummary ? (
                    <p className="text-xs text-emerald-700/90 dark:text-emerald-300/90 mt-1">{pendingTagsSummary}</p>
                  ) : null}
                </div>
              ) : null}
            </div>

            {importError ? (
              <p className="text-sm text-destructive">{importError}</p>
            ) : null}

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Default Password *</label>
                <PasswordField
                  id="import-password"
                  placeholder="Temporary password for all imported users"
                  value={importPassword}
                  onChange={(e) => setImportPassword(e.target.value)}
                  className="bg-background border-border text-foreground"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Default Role</label>
                <Select value={importRole} onValueChange={setImportRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="superuser">Super User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {importRows.length > 0 ? (
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">Preview</p>
                  <p className="text-xs text-muted-foreground">
                    {validImportRows.length} ready · {importRows.length - validImportRows.length} skipped
                  </p>
                </div>
                <div className="max-h-56 overflow-y-auto divide-y divide-border">
                  {importRows.map((row) => (
                    <div key={`${row.rowNumber}-${row.email}`} className="px-4 py-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">{row.fullName || 'Unnamed user'}</p>
                        <span className="text-muted-foreground">{row.email}</span>
                        {row.valid ? (
                          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Ready</span>
                        ) : (
                          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Skipped</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {row.department || 'No department'} · {row.designation || 'No designation'}
                        {row.willCreateDepartment || row.willCreateDesignation ? (
                          <span className="text-primary">
                            {' '}
                            · New {[
                              row.willCreateDepartment ? 'department' : '',
                              row.willCreateDesignation ? 'designation' : '',
                            ].filter(Boolean).join(' & ')} pending
                          </span>
                        ) : null}
                      </p>
                      {row.issues.length > 0 ? (
                        <p className="text-xs text-destructive mt-1">{row.issues.join(' · ')}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter className="flex-shrink-0 px-4 py-4 border-t border-border bg-card">
            <Button variant="outline" onClick={closeImport}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkImport}
              disabled={
                !importPassword.trim()
                || !aiScanComplete
                || validImportRows.length === 0
                || bulkImportUsers.isPending
                || isAiScanning
              }
            >
              {bulkImportUsers.isPending
                ? 'Creating users...'
                : `Create ${validImportRows.length} User${validImportRows.length === 1 ? '' : 's'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {importSuccessOverlay ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-xl border border-emerald-500/30 bg-card px-6 py-5 text-center shadow-2xl">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
              <BadgeCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-base font-semibold text-foreground">{importSuccessOverlay}</p>
          </div>
        </div>
      ) : null}

      <Dialog open={showBulkEdit} onOpenChange={(open) => (open ? setShowBulkEdit(true) : closeBulkEditDialog())}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Selected Users</DialogTitle>
            <DialogDescription>
              Apply changes to {selectedUserIds.length} selected user{selectedUserIds.length === 1 ? '' : 's'}. Leave a field on &quot;No change&quot; to keep existing values.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Role</label>
              <Select
                value={bulkEditForm.role}
                onValueChange={(value) => setBulkEditForm((current) => ({ ...current, role: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No change" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={BULK_NO_CHANGE}>No change</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="superuser">Super User</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Department</label>
              <Select
                value={bulkEditForm.department_id}
                onValueChange={(value) => setBulkEditForm((current) => ({ ...current, department_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No change" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={BULK_NO_CHANGE}>No change</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                  {sortedDepartments.map((department) => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Designation</label>
              <Select
                value={bulkEditForm.designation_id}
                onValueChange={(value) => setBulkEditForm((current) => ({ ...current, designation_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No change" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={BULK_NO_CHANGE}>No change</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                  {sortedDesignations.map((designation) => (
                    <SelectItem key={designation.id} value={designation.id}>
                      {designation.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Assigned Admin</label>
              <Select
                value={bulkEditForm.admin_id}
                onValueChange={(value) => setBulkEditForm((current) => ({ ...current, admin_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No change" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={BULK_NO_CHANGE}>No change</SelectItem>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {adminUsers.map((admin) => (
                    <SelectItem key={admin.id} value={admin.id}>
                      {userLabel(admin)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Applies to selected staff users only. Admins and super users are skipped.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeBulkEditDialog}>Cancel</Button>
            <Button onClick={handleBulkEditSubmit} disabled={bulkUpdateUsers.isPending}>
              {bulkUpdateUsers.isPending ? 'Saving...' : `Update ${selectedUserIds.length} User${selectedUserIds.length === 1 ? '' : 's'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showBulkDelete} onOpenChange={setShowBulkDelete}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Selected Users</DialogTitle>
            <DialogDescription>
              This will permanently delete {deletableSelectedUserIds.length} selected user{deletableSelectedUserIds.length === 1 ? '' : 's'}. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-48 overflow-y-auto rounded-lg border border-border divide-y divide-border">
            {selectedUsers
              .filter((user) => deletableSelectedUserIds.includes(user.id))
              .map((user) => (
                <div key={user.id} className="px-4 py-2 text-sm">
                  <p className="font-medium text-foreground">{userLabel(user)}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
              ))}
          </div>
          {selectedUserIds.length > deletableSelectedUserIds.length ? (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Your own account is excluded from deletion.
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={bulkDeleteUsers.isPending || deletableSelectedUserIds.length === 0}>
              {bulkDeleteUsers.isPending ? 'Deleting...' : `Delete ${deletableSelectedUserIds.length} User${deletableSelectedUserIds.length === 1 ? '' : 's'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showForm} onOpenChange={(open) => (open ? setShowForm(true) : closeForm())}>
        <DialogContent className="max-w-sm max-h-[80dvh] flex flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="flex-shrink-0 px-4 pt-4 pb-3">
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Add a new super user, admin, or staff user to the system.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-4 space-y-3">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Full Name</label>
              <Input
                placeholder="e.g. Jane Doe"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className="bg-background border-border text-foreground"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Email *</label>
              <Input
                type="email"
                placeholder="e.g. jane@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="bg-background border-border text-foreground"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Temporary Password *</label>
              <PasswordField
                id="create-user-password"
                placeholder="Set a password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="bg-background border-border text-foreground"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Role</label>
              <Select
                value={form.role}
                onValueChange={(value) => setForm({ ...form, role: value, admin_id: '' })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="superuser">Super User</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Department</label>
              <Select
                value={form.department_id || 'none'}
                onValueChange={(value) => setForm({ ...form, department_id: value === 'none' ? '' : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {sortedDepartments.map((department) => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Designation</label>
              <Select
                value={form.designation_id || 'none'}
                onValueChange={(value) => setForm({ ...form, designation_id: value === 'none' ? '' : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a designation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {sortedDesignations.map((designation) => (
                    <SelectItem key={designation.id} value={designation.id}>
                      {designation.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.role === 'staff' && (
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Assign to Admin (optional)</label>
                <Select
                  value={form.admin_id || 'none'}
                  onValueChange={(value) => setForm({ ...form, admin_id: value === 'none' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select admin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {adminUsers.map((admin) => (
                      <SelectItem key={admin.id} value={admin.id}>
                        {userLabel(admin)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter className="flex-shrink-0 px-4 py-4 border-t border-border bg-card">
            <Button variant="outline" onClick={closeForm}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!form.email.trim() || !form.password.trim() || createUser.isPending}>
              {createUser.isPending ? 'Saving...' : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!assignTarget} onOpenChange={(open) => { if (!open) closeAssignDialog(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Assign Admin to {userLabel(assignTarget)}
            </DialogTitle>
            <DialogDescription>
              Choose which admin will manage this staff member&apos;s tasks, timesheets, and team activity.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="text-sm font-medium text-foreground mb-1.5 block">Managing Admin</label>
            <Select value={selectedAdminId} onValueChange={setSelectedAdminId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an admin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None — unassigned</SelectItem>
                {adminUsers.map((admin) => (
                  <SelectItem key={admin.id} value={admin.id}>
                    {userLabel(admin)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeAssignDialog}>Cancel</Button>
            <Button onClick={handleAssign} disabled={assignAdmin.isPending}>
              {assignAdmin.isPending ? 'Saving...' : 'Save Assignment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
