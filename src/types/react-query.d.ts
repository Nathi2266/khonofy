import type {
  MutationFunction,
  QueryClient,
  UseMutationOptions,
  UseMutationResult,
} from "@tanstack/react-query";

declare module "@tanstack/react-query" {
  export function useMutation<
    TData = unknown,
    TError = Error,
    TVariables = any,
    TContext = unknown,
  >(
    options: UseMutationOptions<TData, TError, TVariables, TContext>,
    queryClient?: QueryClient,
  ): UseMutationResult<TData, TError, TVariables, TContext>;

  export type MutationFunction<TData = unknown, TVariables = any> = (
    variables: TVariables,
  ) => Promise<TData>;
}
