import * as React from "react"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
}

export function Pagination({ currentPage, totalPages, onPageChange, className }: PaginationProps) {
  const maxVisiblePages = 5
  
  // Calculate page range to show
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2))
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)
  
  if (endPage - startPage < maxVisiblePages - 1) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1)
  }
  
  const pages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i)
  
  return (
    <div className={cn("flex items-center justify-center gap-1", className)}>
      {/* First Page */}
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 relative"
        onClick={() => onPageChange(1)}
        disabled={currentPage === 1}
      >
        <ChevronsLeft className="h-4 w-4" />
        <span className="sr-only">First page</span>
      </Button>
      
      {/* Previous Page */}
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 relative"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        <ChevronLeft className="h-4 w-4" />
        <span className="sr-only">Previous page</span>
      </Button>
      
      {/* Page Numbers */}
      {startPage > 1 && (
        <>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(1)}
          >
            1
          </Button>
          {startPage > 2 && (
            <span className="flex h-8 w-8 items-center justify-center">
              <MoreHorizontal className="h-4 w-4" />
            </span>
          )}
        </>
      )}
      
      {pages.map((page) => (
        <Button
          key={page}
          variant={page === currentPage ? "default" : "outline"}
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(page)}
        >
          {page}
        </Button>
      ))}
      
      {endPage < totalPages && (
        <>
          {endPage < totalPages - 1 && (
            <span className="flex h-8 w-8 items-center justify-center">
              <MoreHorizontal className="h-4 w-4" />
            </span>
          )}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(totalPages)}
          >
            {totalPages}
          </Button>
        </>
      )}
      
      {/* Next Page */}
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 relative"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        <ChevronRight className="h-4 w-4" />
        <span className="sr-only">Next page</span>
      </Button>
      
      {/* Last Page */}
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 relative"
        onClick={() => onPageChange(totalPages)}
        disabled={currentPage === totalPages}
      >
        <ChevronsRight className="h-4 w-4" />
        <span className="sr-only">Last page</span>
      </Button>
    </div>
  )
}

export function PaginationInfo({ 
  currentPage, 
  totalPages, 
  totalItems,
  itemsPerPage,
  className 
}: {
  currentPage: number
  totalPages: number
  totalItems: number
  itemsPerPage: number
  className?: string
}) {
  const startItem = (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalItems)
  
  return (
    <div className={cn("text-sm text-muted-foreground", className)}>
      Showing <span className="font-medium text-foreground">{startItem}</span> to{" "}
      <span className="font-medium text-foreground">{endItem}</span> of{" "}
      <span className="font-medium text-foreground">{totalItems}</span> parts
    </div>
  )
}
