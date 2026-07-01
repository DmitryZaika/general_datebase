import { type LoaderFunctionArgs, redirect } from 'react-router'

export const loader = async ({ params }: LoaderFunctionArgs) => {
  return redirect(`/admin/suppliers/edit/${params.supplier}`)
}
