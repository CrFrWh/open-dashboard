interface Dataset {
  id: string;
  name: string;
  data: Record<string, unknown>[];
  schema: { field: string; type: string }[];
}

interface SampleDatasetsProps {
  onDatasetSelected: (dataset: Dataset) => void;
}

const sampleDatasets = [
  {
    id: "sales-data",
    name: "Sales Data",
    description: "Monthly sales data with categories and regions",
    data: [
      {
        month: "Jan",
        category: "Electronics",
        region: "North",
        sales: 15000,
        units: 120,
      },
      {
        month: "Jan",
        category: "Clothing",
        region: "North",
        sales: 8000,
        units: 200,
      },
      {
        month: "Jan",
        category: "Electronics",
        region: "South",
        sales: 12000,
        units: 95,
      },
      {
        month: "Feb",
        category: "Electronics",
        region: "North",
        sales: 18000,
        units: 140,
      },
      {
        month: "Feb",
        category: "Clothing",
        region: "North",
        sales: 9500,
        units: 220,
      },
      {
        month: "Feb",
        category: "Electronics",
        region: "South",
        sales: 14000,
        units: 110,
      },
      {
        month: "Mar",
        category: "Electronics",
        region: "North",
        sales: 21000,
        units: 165,
      },
      {
        month: "Mar",
        category: "Clothing",
        region: "North",
        sales: 11000,
        units: 250,
      },
      {
        month: "Mar",
        category: "Electronics",
        region: "South",
        sales: 16000,
        units: 125,
      },
    ],
    schema: [
      { field: "month", type: "string" },
      { field: "category", type: "string" },
      { field: "region", type: "string" },
      { field: "sales", type: "number" },
      { field: "units", type: "number" },
    ],
  },
  {
    id: "employee-data",
    name: "Employee Data",
    description: "Employee information with departments and salaries",
    data: [
      {
        id: 1,
        name: "Alice Johnson",
        department: "Engineering",
        salary: 95000,
        years: 3,
      },
      {
        id: 2,
        name: "Bob Smith",
        department: "Marketing",
        salary: 70000,
        years: 2,
      },
      {
        id: 3,
        name: "Carol Davis",
        department: "Engineering",
        salary: 110000,
        years: 5,
      },
      {
        id: 4,
        name: "David Wilson",
        department: "Sales",
        salary: 80000,
        years: 4,
      },
      {
        id: 5,
        name: "Eva Brown",
        department: "Marketing",
        salary: 75000,
        years: 1,
      },
      {
        id: 6,
        name: "Frank Miller",
        department: "Engineering",
        salary: 120000,
        years: 7,
      },
      {
        id: 7,
        name: "Grace Lee",
        department: "Sales",
        salary: 85000,
        years: 3,
      },
      {
        id: 8,
        name: "Henry Taylor",
        department: "Engineering",
        salary: 100000,
        years: 4,
      },
    ],
    schema: [
      { field: "id", type: "number" },
      { field: "name", type: "string" },
      { field: "department", type: "string" },
      { field: "salary", type: "number" },
      { field: "years", type: "number" },
    ],
  },
  {
    id: "product-data",
    name: "Product Inventory",
    description: "Product catalog with pricing and stock levels",
    data: [
      {
        sku: "ELEC001",
        name: "Laptop Pro",
        category: "Electronics",
        price: 1299,
        stock: 45,
        rating: 4.5,
      },
      {
        sku: "ELEC002",
        name: "Wireless Mouse",
        category: "Electronics",
        price: 29,
        stock: 150,
        rating: 4.2,
      },
      {
        sku: "CLTH001",
        name: "Cotton T-Shirt",
        category: "Clothing",
        price: 19,
        stock: 200,
        rating: 4.0,
      },
      {
        sku: "CLTH002",
        name: "Denim Jeans",
        category: "Clothing",
        price: 59,
        stock: 80,
        rating: 4.3,
      },
      {
        sku: "HOME001",
        name: "Coffee Maker",
        category: "Home",
        price: 89,
        stock: 25,
        rating: 4.4,
      },
      {
        sku: "HOME002",
        name: "Table Lamp",
        category: "Home",
        price: 45,
        stock: 60,
        rating: 4.1,
      },
      {
        sku: "ELEC003",
        name: "Smartphone",
        category: "Electronics",
        price: 699,
        stock: 30,
        rating: 4.6,
      },
    ],
    schema: [
      { field: "sku", type: "string" },
      { field: "name", type: "string" },
      { field: "category", type: "string" },
      { field: "price", type: "number" },
      { field: "stock", type: "number" },
      { field: "rating", type: "number" },
    ],
  },
];

export default function SampleDatasets({
  onDatasetSelected,
}: SampleDatasetsProps) {
  const handleSelectDataset = (sampleData: (typeof sampleDatasets)[0]) => {
    const dataset: Dataset = {
      id: sampleData.id,
      name: sampleData.name,
      data: sampleData.data,
      schema: sampleData.schema,
    };
    onDatasetSelected(dataset);
  };

  return (
    <div className="space-y-3">
      {sampleDatasets.map((sample) => (
        <div
          key={sample.id}
          className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 cursor-pointer transition-colors"
          onClick={() => handleSelectDataset(sample)}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className="font-medium text-gray-900">{sample.name}</h4>
              <p className="text-sm text-gray-600 mt-1">{sample.description}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {sample.schema.slice(0, 4).map((field) => (
                  <span
                    key={field.field}
                    className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded"
                  >
                    {field.field}
                  </span>
                ))}
                {sample.schema.length > 4 && (
                  <span className="text-xs text-gray-500">
                    +{sample.schema.length - 4} more
                  </span>
                )}
              </div>
            </div>
            <div className="text-sm text-gray-500 ml-4">
              {sample.data.length} rows
            </div>
          </div>
        </div>
      ))}

      <div className="text-xs text-gray-500 mt-4">
        <p>Click any sample dataset to load it into the dashboard.</p>
        <p>
          Hover over a sample and click the delete icon to remove it from this
          list.
        </p>
      </div>
    </div>
  );
}
