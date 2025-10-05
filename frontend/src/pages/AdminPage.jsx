import { useMemo, useState } from "react";

const toLocalDateTimeInput = iso => {
	if (!iso) return "";
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return "";
	return date.toISOString().slice(0, 16);
};

const toIsoString = value => {
	if (!value) return undefined;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		throw new Error("Timestamp is invalid");
	}
	return date.toISOString();
};

const createInitialFormState = () => {
	const now = new Date();
	const timestamp = toLocalDateTimeInput(now.toISOString());
	return {
		id: "",
		amount: "",
		currency: "USD",
		timestamp,
		payment_method: "ach",
		device_id: "",
		display: "",
		route_display: "",
		latency_ms: "0",
		metadata_note: "",
		"origin.city": "",
		"origin.country": "",
		"origin.region": "",
		"origin.lat": "",
		"origin.lng": "",
		"destination.city": "",
		"destination.country": "",
		"destination.region": "",
		"destination.lat": "",
		"destination.lng": "",
	};
};

const sampleFormState = {
	id: "txn_test_approve_flag_001",
	amount: "81",
	currency: "USD",
	timestamp: toLocalDateTimeInput("2025-10-04T14:51:08Z"),
	payment_method: "ach",
	device_id: "dev_live_001",
	display: "$81 USD • ach",
	route_display: "RU → ZA (Eastern Europe → Africa)",
	latency_ms: "0",
	metadata_note: "live-demo-sample",
	"origin.city": "Moscow",
	"origin.country": "RU",
	"origin.region": "Eastern Europe",
	"origin.lat": "55.7",
	"origin.lng": "37.6",
	"destination.city": "Johannesburg",
	"destination.country": "ZA",
	"destination.region": "Africa",
	"destination.lat": "-26.2",
	"destination.lng": "28",
};

function parseNumber(value, label) {
	if (value === undefined || value === null || value === "") {
		throw new Error(`${label} is required`);
	}
	const num = Number(value);
	if (!Number.isFinite(num)) {
		throw new Error(`${label} must be a number`);
	}
	return num;
}

function requireString(value, label) {
	if (value === undefined || value === null) {
		throw new Error(`${label} is required`);
	}
	const trimmed = value.trim();
	if (!trimmed) {
		throw new Error(`${label} is required`);
	}
	return trimmed;
}

function buildPayload(form) {
	const payload = {
		amount: parseNumber(form.amount, "Amount"),
		currency: requireString(form.currency, "Currency").toUpperCase(),
		payment_method: requireString(form.payment_method, "Payment method"),
		device_id: requireString(form.device_id, "Device ID"),
		origin: {
			city: requireString(form["origin.city"], "Origin city"),
			country: requireString(form["origin.country"], "Origin country"),
			region: requireString(form["origin.region"], "Origin region"),
			lat: parseNumber(form["origin.lat"], "Origin latitude"),
			lng: parseNumber(form["origin.lng"], "Origin longitude"),
		},
		destination: {
			city: requireString(form["destination.city"], "Destination city"),
			country: requireString(form["destination.country"], "Destination country"),
			region: requireString(form["destination.region"], "Destination region"),
			lat: parseNumber(form["destination.lat"], "Destination latitude"),
			lng: parseNumber(form["destination.lng"], "Destination longitude"),
		},
	};

	const id = form.id?.trim();
	if (id) payload.id = id;

	const display = form.display?.trim();
	if (display) payload.display = display;

	const routeDisplay = form.route_display?.trim();
	if (routeDisplay) payload.route_display = routeDisplay;

	const latency = form.latency_ms?.trim();
	if (latency) payload.latency_ms = parseNumber(latency, "Latency");

	const note = form.metadata_note?.trim();
	if (note) {
		payload.metadata = { note };
	}

	const timestamp = form.timestamp?.trim();
	if (timestamp) {
		payload.timestamp = toIsoString(timestamp);
	}

	return payload;
}

export default function AdminPage({ onBack }) {
	const [form, setForm] = useState(createInitialFormState);
	const [status, setStatus] = useState({ state: "idle" });
	const [history, setHistory] = useState([]);

	const previewPayload = useMemo(() => {
		try {
			return buildPayload(form);
		} catch (error) {
			return null;
		}
	}, [form]);

	const handleChange = event => {
		const { name, value } = event.target;
		setForm(prev => ({ ...prev, [name]: value }));
	};

	const handleSubmit = async event => {
		event.preventDefault();
		let payload;
		try {
			payload = buildPayload(form);
		} catch (error) {
			setStatus({ state: "error", message: error.message });
			return;
		}

		setStatus({ state: "submitting" });

		try {
			const response = await fetch("/api/transactions/manual", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			const data = await response.json().catch(() => ({}));

			if (!response.ok) {
				const message = data?.error || "Failed to submit transaction";
				setStatus({
					state: "error",
					message,
					details: data?.details,
				});
				return;
			}

			setStatus({
				state: "success",
				message: `Transaction ${data.transactionId} queued for processing`,
				result: data,
			});

			setHistory(prev => [
				{
					submittedAt: new Date().toISOString(),
					request: payload,
					response: data,
				},
				...prev,
			].slice(0, 5));

			setForm(createInitialFormState());
		} catch (error) {
			setStatus({
				state: "error",
				message: error.message || "Unexpected error while submitting",
			});
		}
	};

	const handleReset = () => {
		setForm(createInitialFormState());
		setStatus({ state: "idle" });
	};

	const handleSample = () => {
		setForm(sampleFormState);
		setStatus({ state: "idle" });
	};

	return (
		<div className="admin-wrapper">
			<header className="admin-header">
				<button className="back-button" onClick={onBack}>
					<span className="back-button__icon">←</span>
					Back to Dashboard
				</button>
				<div>
					<h1>Manual Transaction Console</h1>
					<p className="app__subtitle">
						Queue live transactions into Firebase and run them through your workflow.
					</p>
				</div>
				<div className="admin-header__actions">
					<button type="button" className="admin-button admin-button--ghost" onClick={handleSample}>
						Load sample data
					</button>
					<button type="button" className="admin-button admin-button--ghost" onClick={handleReset}>
						Reset form
					</button>
				</div>
			</header>

			<main className="admin-content">
				<section className="panel admin-form-panel">
					<form className="admin-form" onSubmit={handleSubmit}>
						<div className="admin-fieldset">
							<h2>Transaction Details</h2>
							<div className="admin-grid">
								<label>
									Transaction ID
									<input
										name="id"
										value={form.id}
										onChange={handleChange}
										placeholder="Leave blank for auto-generated"
									/>
								</label>
								<label>
									Amount (minor units accepted)
									<input
										name="amount"
										type="number"
										step="0.01"
										required
										value={form.amount}
										onChange={handleChange}
									/>
								</label>
								<label>
									Currency
									<input
										name="currency"
										value={form.currency}
										onChange={handleChange}
										required
									/>
								</label>
								<label>
									Payment Method
									<input
										name="payment_method"
										value={form.payment_method}
										onChange={handleChange}
										required
									/>
								</label>
								<label>
									Device ID
									<input
										name="device_id"
										value={form.device_id}
										onChange={handleChange}
										required
									/>
								</label>
								<label>
									Timestamp
									<input
										name="timestamp"
										type="datetime-local"
										value={form.timestamp}
										onChange={handleChange}
										max={toLocalDateTimeInput(new Date().toISOString())}
									/>
								</label>
								<label>
									Display Text
									<input
										name="display"
										value={form.display}
										onChange={handleChange}
										placeholder="$81 USD • ach"
									/>
								</label>
								<label>
									Route Display
									<input
										name="route_display"
										value={form.route_display}
										onChange={handleChange}
										placeholder="RU → ZA (Eastern Europe → Africa)"
									/>
								</label>
								<label>
									Latency (ms)
									<input
										name="latency_ms"
										type="number"
										step="1"
										min="0"
										value={form.latency_ms}
										onChange={handleChange}
									/>
								</label>
							</div>
						</div>

						<div className="admin-fieldset">
							<h2>Origin</h2>
							<div className="admin-grid">
								<label>
									City
									<input
										name="origin.city"
										value={form["origin.city"]}
										onChange={handleChange}
										required
									/>
								</label>
								<label>
									Country
									<input
										name="origin.country"
										value={form["origin.country"]}
										onChange={handleChange}
										required
									/>
								</label>
								<label>
									Region
									<input
										name="origin.region"
										value={form["origin.region"]}
										onChange={handleChange}
										required
									/>
								</label>
								<label>
									Latitude
									<input
										name="origin.lat"
										type="number"
										step="0.0001"
										value={form["origin.lat"]}
										onChange={handleChange}
										required
									/>
								</label>
								<label>
									Longitude
									<input
										name="origin.lng"
										type="number"
										step="0.0001"
										value={form["origin.lng"]}
										onChange={handleChange}
										required
									/>
								</label>
							</div>
						</div>

						<div className="admin-fieldset">
							<h2>Destination</h2>
							<div className="admin-grid">
								<label>
									City
									<input
										name="destination.city"
										value={form["destination.city"]}
										onChange={handleChange}
										required
									/>
								</label>
								<label>
									Country
									<input
										name="destination.country"
										value={form["destination.country"]}
										onChange={handleChange}
										required
									/>
								</label>
								<label>
									Region
									<input
										name="destination.region"
										value={form["destination.region"]}
										onChange={handleChange}
										required
									/>
								</label>
								<label>
									Latitude
									<input
										name="destination.lat"
										type="number"
										step="0.0001"
										value={form["destination.lat"]}
										onChange={handleChange}
										required
									/>
								</label>
								<label>
									Longitude
									<input
										name="destination.lng"
										type="number"
										step="0.0001"
										value={form["destination.lng"]}
										onChange={handleChange}
										required
									/>
								</label>
							</div>
						</div>

						<div className="admin-fieldset">
							<h2>Metadata</h2>
							<label className="admin-textarea-label">
								Notes
								<textarea
									name="metadata_note"
									rows="3"
									value={form.metadata_note}
									onChange={handleChange}
									placeholder="Optional notes to persist with the transaction"
								/>
							</label>
						</div>

						<div className="admin-submit">
							<button
								type="submit"
								className="admin-button"
								disabled={status.state === "submitting"}
							>
								{status.state === "submitting" ? "Submitting…" : "Submit transaction"}
							</button>
						</div>

						{status.state === "error" && (
							<div className="admin-alert admin-alert--error">
								<strong>{status.message}</strong>
								{status.details && (
									<pre>{JSON.stringify(status.details, null, 2)}</pre>
								)}
							</div>
						)}

						{status.state === "success" && (
							<div className="admin-alert admin-alert--success">
								<strong>{status.message}</strong>
								<p>Firebase key: {status.result?.firebaseKey}</p>
							</div>
						)}
					</form>
				</section>

				<section className="panel admin-preview-panel">
					<h2>Payload Preview</h2>
					<p>
						Review the JSON that will be sent to <code>/transactions</code> in Firebase. The decision will be
						populated automatically by the workflow once processed.
					</p>
					<pre className="admin-preview">
						{previewPayload ? JSON.stringify(previewPayload, null, 2) : "Fill out the required fields to preview the payload."}
					</pre>

					{history.length > 0 && (
						<div className="admin-history">
							<h3>Recent submissions</h3>
							<ul>
								{history.map(item => (
									<li key={item.submittedAt}>
										<span>{new Date(item.submittedAt).toLocaleTimeString()}</span>
										<code>{item.response?.transactionId || "(pending)"}</code>
									</li>
								))}
							</ul>
						</div>
					)}
				</section>
			</main>
		</div>
	);
}
