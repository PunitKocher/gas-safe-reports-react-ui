import React, { useMemo, useState, useEffect } from 'react';
import {
  MaterialReactTable,
  MRT_EditActionButtons,
  type MRT_ColumnDef,
  type MRT_Row,
  type MRT_TableOptions,
  type MRT_ColumnFiltersState,
  type MRT_PaginationState,
  type MRT_SortingState,
} from 'material-react-table';
import {
  Box,
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

type UserApiResponse = {
  _embedded: {
    users: Array<User>;
  };
  page: {
    size: number;
    totalElements: number;
    totalPages: number;
    number: number;
  };
};

type User = {
  id: string;
  fullName: string;
  email: string;
  password: string;
  createdAt: string;
  updatedAt: string;
};

const Example: React.FC = () => {
  const [validationErrors, setValidationErrors] = useState<Record<string, string | undefined>>({});
  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<MRT_SortingState>([]);
  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 1,
    pageSize: 10,
  });
  const [serverError, setServerError] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const fetchData = async () => {
    const fetchURL = new URL('http://localhost:8080/users/search/searchUsers');
    fetchURL.searchParams.set('page', `${pagination.pageIndex}`);
    fetchURL.searchParams.set('size', `${pagination.pageSize}`);
    
    columnFilters.forEach(filter => {
      fetchURL.searchParams.set(filter.id, filter.value as string);
    });

    if (globalFilter) {
      fetchURL.searchParams.set('globalFilter', globalFilter);
    }

    sorting.forEach(sort => {
      fetchURL.searchParams.append('sort', `${sort.id},${sort.desc ? 'desc' : 'asc'}`);
    });

    const response = await fetch(fetchURL.href);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return response.json();
  };

  const { data: { _embedded: { users = [] } = {}, page } = {}, isError, isRefetching, isLoading, refetch } = useQuery<UserApiResponse>({
    queryKey: [
      'table-data',
      columnFilters,
      globalFilter,
      pagination.pageIndex,
      pagination.pageSize,
      sorting,
    ],
    queryFn: fetchData,
    placeholderData: {
      _embedded: {
        users: [],
      },
      page: {
        size: 0,
        totalElements: 0,
        totalPages: 0,
        number: 0,
      },
    },
    refetchOnWindowFocus: false,
  });

  const columns = useMemo<MRT_ColumnDef<User>[]>(
    () => [
      {
        accessorKey: 'id',
        header: 'Id',
        enableEditing: false,
        size: 80,
      },
      {
        accessorKey: 'fullName',
        header: 'Full Name',
        muiEditTextFieldProps: {
          required: true,
          error: !!validationErrors?.fullName,
          helperText: validationErrors?.fullName,
          onFocus: () =>
            setValidationErrors({
              ...validationErrors,
              fullName: undefined,
            }),
        },
      },
      {
        accessorKey: 'email',
        header: 'Email',
        muiEditTextFieldProps: {
          type: 'email',
          required: true,
          error: !!validationErrors?.email,
          helperText: validationErrors?.email,
          onFocus: () =>
            setValidationErrors({
              ...validationErrors,
              email: undefined,
            }),
        },
      },
      {
        accessorKey: 'password',
        header: 'Password',
        muiEditTextFieldProps: {
          required: true,
          error: !!validationErrors?.password,
          helperText: validationErrors?.password,
          onFocus: () =>
            setValidationErrors({
              ...validationErrors,
              password: undefined,
            }),
        },
      },
      {
        accessorKey: 'createdAt',
        header: 'Created At',
        Cell: ({ cell }) => new Date(cell.getValue<string>()).toLocaleString(),
      },
      {
        accessorKey: 'updatedAt',
        header: 'Updated At',
        Cell: ({ cell }) => new Date(cell.getValue<string>()).toLocaleString(),
      },
    ],
    [validationErrors],
  );

  const createUserMutation = useMutation({
    mutationFn: async (user: User) => {
      const response = await fetch('http://localhost:8080/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create user');
      }
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries('table-data'),
  });

  const updateUserMutation = useMutation({
    mutationFn: async (user: User) => {
      const response = await fetch(`http://localhost:8080/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update user');
      }
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries('table-data'),
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`http://localhost:8080/users/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete user');
      }
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries('table-data'),
  });

  const handleCreateUser: MRT_TableOptions<User>['onCreatingRowSave'] = async ({ values, table }) => {
    const newValidationErrors = validateUser(values);
    if (Object.values(newValidationErrors).some((error) => error)) {
      setValidationErrors(newValidationErrors);
      return;
    }
    setValidationErrors({});
    try {
      await createUserMutation.mutateAsync(values);
      table.setCreatingRow(null);
    } catch (error) {
      if (error instanceof Error) {
        const serverErrors = error.message; // Adjust this based on how your server returns errors
        alert(serverErrors);
        setServerError(serverErrors);
      }
    }
  };

  const handleSaveUser: MRT_TableOptions<User>['onEditingRowSave'] = async ({ values, table }) => {
    const newValidationErrors = validateUser(values);
    if (Object.values(newValidationErrors).some((error) => error)) {
      setValidationErrors(newValidationErrors);
      return;
    }
    setValidationErrors({});
    try {
      await updateUserMutation.mutateAsync(values);
      table.setEditingRow(null);
    } catch (error) {
      if (error instanceof Error) {
        const serverErrors = error.message; // Adjust this based on how your server returns errors
        alert(serverErrors);
        setServerError(serverErrors);
      }
    }
  };

  const openDeleteConfirmModal = (row: MRT_Row<User>) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      deleteUserMutation.mutateAsync(row.original.id);
    }
  };
  const isSaving = createUserMutation.isPending || updateUserMutation.isPending || deleteUserMutation.isPending;

  return (
    <MaterialReactTable
      columns={columns}
      data={users}
      initialState={{ showColumnFilters: true }}
      manualFiltering
      manualPagination
      manualSorting
      enableGlobalFilter
      createDisplayMode="modal"
      editDisplayMode="modal"
      enableEditing
      getRowId={(row) => row.id}
      muiToolbarAlertBannerProps={isError
        ? {
            color: 'error',
            children: 'Error loading data',
          }
        : undefined}
      muiTableContainerProps={{
        sx: {
          minHeight: '500px',
        },
      }}
      onCreatingRowCancel={() => setValidationErrors({})}
      onCreatingRowSave={handleCreateUser}
      onEditingRowCancel={() => setValidationErrors({})}
      onEditingRowSave={handleSaveUser}
      onColumnFiltersChange={setColumnFilters}
      onGlobalFilterChange={setGlobalFilter}
      onPaginationChange={setPagination}
      onSortingChange={setSorting}
      renderCreateRowDialogContent={({ table, row, internalEditComponents }) => (
        <>
          <DialogTitle variant="h3">Create New User</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {internalEditComponents}
            {serverError && <Box color="error.main">{serverError}</Box>}
          </DialogContent>
          <DialogActions>
            <MRT_EditActionButtons variant="text" table={table} row={row} />
          </DialogActions>
        </>
      )}
      renderEditRowDialogContent={({ table, row, internalEditComponents }) => (
        <>
          <DialogTitle variant="h3">Edit User</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {internalEditComponents}
            {serverError && <Box color="error.main">{serverError}</Box>}
          </DialogContent>
          <DialogActions>
            <MRT_EditActionButtons variant="text" table={table} row={row} />
          </DialogActions>
        </>
      )}
      renderRowActions={({ row, table }) => (
        <Box sx={{ display: 'flex', gap: '1rem' }}>
          <Tooltip title="Edit">
            <IconButton onClick={() => table.setEditingRow(row)}>
              <EditIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton color="error" onClick={() => openDeleteConfirmModal(row)}>
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Box>
      )}
      renderTopToolbarCustomActions={({ table }) => (
        <Button
          variant="contained"
          onClick={() => {
            table.setCreatingRow(true);
          }}
        >
          Create New User
        </Button>
      )}
      rowCount={page?.totalElements ?? 0}
      state={{
        columnFilters,
        globalFilter,
        isLoading: isSaving || isRefetching,
        pagination,
        showAlertBanner: isError,
        showProgressBars: isRefetching,
        sorting,
      }}
    />
  );
};

const queryClient = new QueryClient();

const ExampleWithReactQueryProvider: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <Example />
  </QueryClientProvider>
);

export default ExampleWithReactQueryProvider;

const validateRequired = (value: string) => !!value.length;
const validateEmail = (email: string) =>
  !!email.length &&
  email
    .toLowerCase()
    .match(
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
    );

function validateUser(user: User) {
  return {
    fullName: !validateRequired(user.fullName) ? 'Full Name is Required' : '',
    email: !validateEmail(user.email) ? 'Incorrect Email Format' : '',
    password: !validateRequired(user.password) ? 'Password is Required' : '',
  };
}
