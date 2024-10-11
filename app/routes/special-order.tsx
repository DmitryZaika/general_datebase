export function SpecialOrder() {
  return (
    <main>
      <h1>Special Order Calculator</h1>
      <div className="calculator-container">
        <label htmlFor="price-per-sqft">Price per Sqft:</label>
        <input
          type="number"
          id="price-per-sqft"
          placeholder="Enter price per sqft"
        />

        <label htmlFor="size">Size of Slab:</label>
        <div className="row">
          <input
            type="number"
            id="width"
            placeholder="Width (inches)"
            min="0"
          />
          <input
            type="number"
            id="length"
            placeholder="Length (inches)"
            min="0"
          />
        </div>

        <div className="slabs-counter">
          <label htmlFor="slabs">Slabs:</label>
          <button type="button" id="decrease-slabs">
            -
          </button>
          <span id="slabs-amount">1</span>
          <button type="button" id="increase-slabs">
            +
          </button>
        </div>

        <div className="result">
          Cost per Sqft $<span id="cost-per-sqft">0.00</span> per sqft
        </div>
        <div className="result">
          Total Square Feet: <span id="total-square-feet">0.00</span> sqft
        </div>
        <div className="result-total">
          Total Cost $<span id="total-cost">0.00</span>
        </div>
      </div>
    </main>
  );
}
